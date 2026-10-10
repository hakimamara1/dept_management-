import type { Customer, Supplier } from '@desktop-types/api'

export type PartyType = 'supplier' | 'customer'

/** One row of the merged accounts list — suppliers and customers share the same shape here. */
export interface PartyRow {
  key: string
  type: PartyType
  id: number
  name: string
  /** Positive = money outstanding on this account (we owe a supplier / a customer owes us). */
  balance: number
  invoiceCount: number | null
  phone: string | null
}

export const fromSupplier = (s: Supplier): PartyRow => ({
  key: `supplier-${s.id}`,
  type: 'supplier',
  id: s.id,
  name: s.name,
  balance: Number(s.current_balance) || 0,
  invoiceCount: s.invoice_count ?? null,
  phone: s.phone
})

export const fromCustomer = (c: Customer): PartyRow => ({
  key: `customer-${c.id}`,
  type: 'customer',
  id: c.id,
  name: c.full_name,
  balance: Number(c.current_balance) || 0,
  invoiceCount: c.total_invoices ?? null,
  phone: c.phone
})

/** Largest outstanding amounts first — that is what the person opening this screen is looking for. */
export const byBalanceDesc = (a: PartyRow, b: PartyRow) => b.balance - a.balance || a.name.localeCompare(b.name)
