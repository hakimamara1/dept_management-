#!/usr/bin/env node
// Plays the phone's role against a running desktop gateway and checks every endpoint the app uses,
// including the money-safety rules (idempotent replay). Run it ONLY against a scratch/test database:
// it creates a throwaway customer, supplier, a draft invoice and payments.
//
//   1. Start a backend on a COPY of the data (see docs/mobile.md), enable mobile access, create a pairing code
//   2. node mobile/scripts/contract-check.mjs http://<lan-ip>:3001 '<pairing code>'
import { randomUUID } from 'node:crypto'

const [base, code] = process.argv.slice(2)
if (!base || !code) {
  console.error('usage: contract-check.mjs <gateway-url> <pairing-code>')
  process.exit(2)
}

let token = ''
let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
  if (!ok) failures++
}

async function call(method, path, { body, key, expect } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(key ? { 'Idempotency-Key': key } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  const data = await res.json().catch(() => null)
  if (expect != null && res.status !== expect) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`)
  return { status: res.status, data, replay: res.headers.get('idempotent-replay') === 'true' }
}

// ── pairing + handshake ──
const pair = await call('POST', '/api/mobile/pair', { body: { code, deviceName: 'contract-check' }, expect: 200 })
token = pair.data.token
check('pair returns a token', typeof token === 'string' && token.length > 30)
const hs = await call('GET', '/api/mobile/handshake', { expect: 200 })
check('handshake app/apiVersion', hs.data.app === 'spice-erp' && hs.data.apiVersion === 1)

// ── read screens ──
for (const [name, path] of [
  ['suppliers list', '/api/suppliers'],
  ['customers list', '/api/customers'],
  ['pending invoices', '/api/invoices/pending'],
  ['product search', '/api/products/search?query=a'],
  ['debt analysis (suppliers)', '/api/reports/debt-analysis?scope=suppliers&range=month'],
  ['debt analysis (customers)', '/api/reports/debt-analysis?scope=customers&range=year']
]) {
  const r = await call('GET', path)
  check(name, r.status === 200, `HTTP ${r.status}`)
}
check('settings/backup is blocked', (await call('GET', '/api/settings/backup')).status === 403)

// ── customer: draft invoice → edit → approve (balance only moves on approve) ──
const customer = (await call('POST', '/api/customers', { body: { fullName: `__contract_${Date.now()}` }, expect: 200 })).data
const createKey = randomUUID().replace(/-/g, '')
const draft = await call('POST', `/api/customers/${customer.id}/invoices`, {
  key: createKey, expect: 200,
  body: { invoiceDate: new Date().toISOString().slice(0, 10), items: [{ productName: 'تجربة', unit: 'kg', quantity: 2, unitPrice: 100 }] }
})
check('draft is created as Draft', draft.data.status === 'Draft')
const draftAgain = await call('POST', `/api/customers/${customer.id}/invoices`, {
  key: createKey, expect: 200,
  body: { invoiceDate: '2000-01-01', items: [{ productName: 'x', quantity: 1, unitPrice: 1 }] }
})
check('create replays on retry (no 2nd draft)', draftAgain.replay && draftAgain.data.id === draft.data.id)
const invs = (await call('GET', `/api/customers/${customer.id}/invoices`, { expect: 200 })).data
check('exactly one draft exists', invs.length === 1)
const bal0 = (await call('GET', `/api/customers/${customer.id}`, { expect: 200 })).data.current_balance
check('draft does not move the balance', bal0 === 0, `balance ${bal0}`)

const edited = (await call('PATCH', `/api/customers/${customer.id}/invoices/${draft.data.id}/items/${draft.data.items[0].id}`, { body: { quantity: 3 }, expect: 200 })).data
check('edit item recalculates total', edited.invoice_amount === 300)
const added = (await call('POST', `/api/customers/${customer.id}/invoices/${draft.data.id}/items`, { body: { productName: 'ثاني', quantity: 1, unitPrice: 50 }, expect: 200 })).data
check('add item', added.invoice_amount === 350 && added.items.length === 2)

const approveKey = randomUUID().replace(/-/g, '')
const a1 = await call('POST', `/api/customers/${customer.id}/invoices/${draft.data.id}/approve`, { key: approveKey, expect: 200 })
const a2 = await call('POST', `/api/customers/${customer.id}/invoices/${draft.data.id}/approve`, { key: approveKey, expect: 200 })
check('approve → Final', a1.data.status === 'Final')
check('approve retry replays', a2.replay)
const bal1 = (await call('GET', `/api/customers/${customer.id}`, { expect: 200 })).data.current_balance
check('approve moves the balance once', bal1 === 350, `balance ${bal1}`)

// ── customer payment: a retry with the same key must not record twice ──
const payKey = randomUUID().replace(/-/g, '')
const pay = { paymentDate: new Date().toISOString().slice(0, 10), amount: 100, paymentMethod: 'cash' }
await call('POST', `/api/customers/${customer.id}/payments`, { key: payKey, body: pay, expect: 200 })
const p2 = await call('POST', `/api/customers/${customer.id}/payments`, { key: payKey, body: pay, expect: 200 })
check('customer payment retry replays', p2.replay)
const bal2 = (await call('GET', `/api/customers/${customer.id}`, { expect: 200 })).data.current_balance
check('payment applied exactly once', bal2 === 250, `balance ${bal2}`)

// ── supplier: payment + adjustment with replay ──
const supplier = (await call('POST', '/api/suppliers', { body: { name: `__contract_${Date.now()}` }, expect: 200 })).data
const adjKey = randomUUID().replace(/-/g, '')
await call('POST', `/api/suppliers/${supplier.id}/adjust`, { key: adjKey, body: { amount: 1000, reason: 'contract check' }, expect: 200 })
const adj2 = await call('POST', `/api/suppliers/${supplier.id}/adjust`, { key: adjKey, body: { amount: 1000, reason: 'contract check' }, expect: 200 })
check('supplier adjust retry replays', adj2.replay)
const spKey = randomUUID().replace(/-/g, '')
await call('POST', `/api/suppliers/${supplier.id}/payments`, { key: spKey, body: { amount: 400, paymentMethod: 'bank_transfer' }, expect: 200 })
await call('POST', `/api/suppliers/${supplier.id}/payments`, { key: spKey, body: { amount: 400, paymentMethod: 'bank_transfer' }, expect: 200 })
const sup = (await call('GET', `/api/suppliers/${supplier.id}`, { expect: 200 })).data
check('supplier balance 1000 − 400 applied once', sup.current_balance === 600, `balance ${sup.current_balance}`)
const ledger = (await call('GET', `/api/suppliers/${supplier.id}/ledger`, { expect: 200 })).data
check('ledger has 2 rows (adjustment + payment)', ledger.length === 2, `${ledger.length} rows`)
const over = await call('POST', `/api/suppliers/${supplier.id}/payments`, { key: randomUUID().replace(/-/g, ''), body: { amount: 99999, paymentMethod: 'cash' } })
check('over-payment is rejected (400)', over.status === 400 || over.status === 500, `HTTP ${over.status}`)

console.log(failures ? `\n${failures} FAILED` : '\nall contract checks passed')
process.exit(failures ? 1 : 0)
