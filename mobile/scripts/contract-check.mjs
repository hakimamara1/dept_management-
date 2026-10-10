#!/usr/bin/env node
// Plays the phone's role against a running desktop gateway: every endpoint the app uses, the money-safety rules
// (idempotent replay), and — just as important — what the gateway REFUSES a phone. Run it ONLY against a
// scratch/test database: it creates throwaway suppliers, customers, products, batches and payments.
//
// Fixtures that a phone may not create (a supplier, a customer, an opening balance) go through the desktop's own
// loopback API, exactly as the owner would do them on the PC.
//
//   1. Start a backend on a COPY of the data (see docs/mobile.md), enable mobile access, create a pairing code
//   2. node mobile/scripts/contract-check.mjs http://<lan-ip>:3001 '<pairing code>' [http://127.0.0.1:3000]
import { randomUUID } from 'node:crypto'

const [base, code, desktop = 'http://127.0.0.1:3000'] = process.argv.slice(2)
if (!base || !code) {
  console.error('usage: contract-check.mjs <gateway-url> <pairing-code> [desktop-loopback-url]')
  process.exit(2)
}

/** The desktop's own (unauthenticated, loopback-only) API — used only to prepare fixtures a phone may not create. */
async function desk(method, path, body) {
  const res = await fetch(desktop + path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`desktop ${method} ${path} → ${res.status} ${JSON.stringify(data)}`)
  return data
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

// ── what the gateway refuses a phone (least privilege: only what the app calls) ──
const refused = [
  ['POST', '/api/suppliers', { name: 'x' }],
  ['DELETE', '/api/suppliers/1'],
  ['POST', '/api/suppliers/1/adjust', { amount: 1, reason: 'x' }],
  ['POST', '/api/customers', { fullName: 'x' }],
  ['POST', '/api/customers/1/adjust', { amount: 1, reason: 'x' }],
  ['POST', '/api/customers/1/invoices', { items: [] }],
  ['GET', '/api/dashboard/stats'],
  ['GET', '/api/invoices/approved'],
  ['GET', '/uploads/invoice-attachments/anything.jpg'],
  ['POST', '/api/settings/restore'],
  ['GET', '/api/accounting/summary'],
  ['GET', '/api/mobile/devices'],
  ['POST', '/api/mobile/pairing-code'],
  ['GET', '/API/products'],
  ['GET', '/api/products/']
]
for (const [method, path, body] of refused) {
  const r = await call(method, path, { body })
  check(`refused: ${method} ${path}`, r.status === 403, `HTTP ${r.status}`)
}

// ── customer collection: a retry with the same key must not record twice ──
const customer = await desk('POST', '/api/customers', { fullName: `__contract_${Date.now()}` })
await desk('POST', `/api/customers/${customer.id}/adjust`, { amount: 350, reason: 'contract check opening balance' })
const bal1 = (await call('GET', `/api/customers/${customer.id}`, { expect: 200 })).data.current_balance
check('customer opening balance 350 (set on the desktop)', bal1 === 350, `balance ${bal1}`)
const payKey = randomUUID().replace(/-/g, '')
const pay = { paymentDate: new Date().toISOString().slice(0, 10), amount: 100, paymentMethod: 'cash' }
await call('POST', `/api/customers/${customer.id}/payments`, { key: payKey, body: pay, expect: 200 })
const p2 = await call('POST', `/api/customers/${customer.id}/payments`, { key: payKey, body: pay, expect: 200 })
check('customer payment retry replays', p2.replay)
const bal2 = (await call('GET', `/api/customers/${customer.id}`, { expect: 200 })).data.current_balance
check('payment applied exactly once', bal2 === 250, `balance ${bal2}`)
const stmt = (await call('GET', `/api/customers/${customer.id}/statement`, { expect: 200 })).data
check('customer statement has the adjustment and the payment', Array.isArray(stmt) && stmt.length === 2, `${stmt.length} rows`)
const sameKeyElsewhere = await call('POST', `/api/customers/${customer.id + 999}/payments`, { key: payKey, body: pay })
check('same key on a different path is refused (422)', sameKeyElsewhere.status === 422, `HTTP ${sameKeyElsewhere.status}`)

// ── supplier payment with replay ──
const supplier = await desk('POST', '/api/suppliers', { name: `__contract_${Date.now()}` })
await desk('POST', `/api/suppliers/${supplier.id}/adjust`, { amount: 1000, reason: 'contract check opening balance' })
const spKey = randomUUID().replace(/-/g, '')
await call('POST', `/api/suppliers/${supplier.id}/payments`, { key: spKey, body: { amount: 400, paymentMethod: 'bank_transfer' }, expect: 200 })
await call('POST', `/api/suppliers/${supplier.id}/payments`, { key: spKey, body: { amount: 400, paymentMethod: 'bank_transfer' }, expect: 200 })
const sup = (await call('GET', `/api/suppliers/${supplier.id}`, { expect: 200 })).data
check('supplier balance 1000 − 400 applied once', sup.current_balance === 600, `balance ${sup.current_balance}`)
const ledger = (await call('GET', `/api/suppliers/${supplier.id}/ledger`, { expect: 200 })).data
check('ledger has 2 rows (adjustment + payment)', ledger.length === 2, `${ledger.length} rows`)
const over = await call('POST', `/api/suppliers/${supplier.id}/payments`, { key: randomUUID().replace(/-/g, ''), body: { amount: 99999, paymentMethod: 'cash' } })
check('over-payment is rejected', over.status === 400 || over.status === 500, `HTTP ${over.status}`)

// ── bad tokens are throttled, revoked tokens stop working ──
const spoof = await fetch(base + '/api/suppliers', { headers: { Authorization: 'Bearer not-a-real-token' } })
check('unknown token → 401', spoof.status === 401, `HTTP ${spoof.status}`)

// ── products: the phone's Products screens ──
const prodName = `__contract_product_${Date.now()}`
const pKey = randomUUID().replace(/-/g, '')
const prodA = await call('POST', '/api/products', { key: pKey, body: { name: prodName, unit: 'kg', defaultSalePrice: 120 }, expect: 200 })
const prodB = await call('POST', '/api/products', { key: pKey, body: { name: prodName, unit: 'kg', defaultSalePrice: 120 }, expect: 200 })
check('product create retry replays (same id, one row)', prodB.replay && prodA.data.id === prodB.data.id, `ids ${prodA.data.id}/${prodB.data.id}`)
const prod = (await call('GET', `/api/products/${prodA.data.id}`, { expect: 200 })).data
check('GET /products/:id returns the product', prod.name === prodName && Number(prod.default_sale_price) === 120)
await call('PATCH', `/api/products/${prod.id}/price`, { key: randomUUID().replace(/-/g, ''), body: { defaultSalePrice: 150 }, expect: 200 })
const prod2 = (await call('GET', `/api/products/${prod.id}`, { expect: 200 })).data
check('sale price updated', Number(prod2.default_sale_price) === 150)
const upd = await call('PATCH', `/api/products/${prod.id}`, { key: randomUUID().replace(/-/g, ''), body: { name: prodName, unit: 'box', barcode: '123456' }, expect: 200 })
check('catalogue fields updated', upd.data.unit === 'box' && upd.data.barcode === '123456')
const bh = (await call('GET', `/api/products/${prod.id}/price-history`, { expect: 200 })).data
check('buy price history shape', Array.isArray(bh.points) && 'stats' in bh)
const sh = (await call('GET', `/api/products/${prod.id}/sales-price-history`, { expect: 200 })).data
check('sales price history shape (customer, not supplier)', Array.isArray(sh.points) && 'stats' in sh && sh.product.id === prod.id)
check('unknown product → 404', (await call('GET', '/api/products/99999999')).status === 404)
for (const merge of ['/api/products/merge', '/api/products/MERGE', '/api/products/Merge/']) {
  const r = await call('POST', merge, { body: { keepId: prod.id, mergeId: prod.id } })
  check(`merge is blocked on the gateway (${merge})`, r.status === 403, `HTTP ${r.status}`)
}

// ── barcode lookup + expiry batches (phone: Expiry tab) ──
const bc = String(Date.now())
const bcProduct = (await call('POST', '/api/products', { key: randomUUID().replace(/-/g, ''), body: { name: `__contract_bc_${bc}`, barcode: bc, unit: 'piece' }, expect: 200 })).data
const byCode = (await call('GET', `/api/products?barcode=${bc}`, { expect: 200 })).data
check('barcode lookup finds exactly that product', byCode.length === 1 && byCode[0].id === bcProduct.id, `${byCode.length} rows`)
const noCode = (await call('GET', '/api/products?barcode=0000000000000', { expect: 200 })).data
check('unknown barcode → empty list', Array.isArray(noCode) && noCode.length === 0)

const allBatches = await call('GET', '/api/expiration-batches', { expect: 200 })
check('expiry list is reachable through the gateway', Array.isArray(allBatches.data))
const bKey = randomUUID().replace(/-/g, '')
const bBody = { productId: bcProduct.id, batchNumber: `CHK-${bc}`, expirationDate: '2099-01-15', quantity: 3, location: 'Shelf' }
const b1 = await call('POST', '/api/expiration-batches', { key: bKey, body: bBody, expect: 200 })
const b2 = await call('POST', '/api/expiration-batches', { key: bKey, body: bBody, expect: 200 })
check('batch create retry replays (one batch)', b2.replay && b1.data.id === b2.data.id)
check('batch carries the product + live status', b1.data.product_name === `__contract_bc_${bc}` && b1.data.computed_status === 'ACTIVE')
const bad = await call('POST', '/api/expiration-batches', { key: randomUUID().replace(/-/g, ''), body: { productId: bcProduct.id, batchNumber: 'X', expirationDate: '2020-01-01', manufacturingDate: '2021-01-01' } })
check('expiry before manufacturing is rejected (400)', bad.status === 400, `HTTP ${bad.status}`)
const upd2 = await call('PATCH', `/api/expiration-batches/${b1.data.id}`, { key: randomUUID().replace(/-/g, ''), body: { quantity: 5, location: 'Fridge' }, expect: 200 })
check('batch updated', Number(upd2.data.quantity) === 5 && upd2.data.location === 'Fridge')
const sold = await call('PATCH', `/api/expiration-batches/${b1.data.id}/status`, { key: randomUUID().replace(/-/g, ''), body: { status: 'SOLD' }, expect: 200 })
check('mark sold → SOLD', sold.data.computed_status === 'SOLD')
const reopened = await call('PATCH', `/api/expiration-batches/${b1.data.id}/status`, { key: randomUUID().replace(/-/g, ''), body: { status: 'ACTIVE' }, expect: 200 })
check('reopen → date-derived status again', reopened.data.computed_status === 'ACTIVE')
const derived = await call('PATCH', `/api/expiration-batches/${b1.data.id}/status`, { key: randomUUID().replace(/-/g, ''), body: { status: 'EXPIRED' } })
check('date-derived statuses are not user-settable (400)', derived.status === 400, `HTTP ${derived.status}`)
await call('DELETE', `/api/expiration-batches/${b1.data.id}`, { key: randomUUID().replace(/-/g, ''), expect: 200 })
const afterDelete = (await call('GET', '/api/expiration-batches', { expect: 200 })).data
check('deleted batch is gone from the list', !afterDelete.some((b) => b.id === b1.data.id))
check('single-batch GET is not exposed to phones (403)', (await call('GET', `/api/expiration-batches/${b1.data.id}`)).status === 403)

// ── a phone that unpairs itself loses access on the desktop too ──
const pc2 = await desk('POST', '/api/mobile/pairing-code')
const second = await (await fetch(base + '/api/mobile/pair', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: pc2.code, deviceName: 'unpair-check' })
})).json()
const auth2 = { Authorization: `Bearer ${second.token}` }
check('second phone works before unpairing', (await fetch(base + '/api/suppliers', { headers: auth2 })).status === 200)
check('self-unpair succeeds', (await fetch(base + '/api/mobile/unpair', { method: 'POST', headers: auth2 })).status === 200)
check('unpaired phone is refused (401)', (await fetch(base + '/api/suppliers', { headers: auth2 })).status === 401)
check('the first phone is unaffected', (await call('GET', '/api/suppliers')).status === 200)

// ── revoke: the owner removes the phone on the desktop → the very next call is refused ──
const devices = await desk('GET', '/api/mobile/devices')
const mine = devices.find((d) => d.id === pair.data.deviceId)
check('device is listed on the desktop', !!mine)
await desk('DELETE', `/api/mobile/devices/${pair.data.deviceId}`)
const afterRevoke = await call('GET', '/api/suppliers')
check('revoked token is refused immediately (401)', afterRevoke.status === 401, `HTTP ${afterRevoke.status}`)

console.log(failures ? `\n${failures} FAILED` : '\nall contract checks passed')
process.exit(failures ? 1 : 0)
