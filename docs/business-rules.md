# Business Rules

Rules here are enforced in `src/services/*.js`. If a rule isn't enforced in
code yet, it's marked **(not yet enforced)** — don't assume validation exists
just because it's documented as a rule.

## Cross-cutting: append-only ledgers

Any table that represents "what happened over time" is **append-only** —
rows are inserted, never updated to change a balance, never deleted. This
applies to `stock_movements`, `supplier_transactions`, `accounting_transactions`,
`sales_invoices`, `sales_invoice_items`, `customer_payments`. The only
exceptions are deliberate **snapshot columns** that cache a derived value for
read performance and are recomputed/rewritten on every relevant write:
`suppliers.current_balance`, `products.average_cost`/`last_purchase_price`.
Never add a new snapshot column without a corresponding ADR in `decisions.md`
— it's an exception to the default rule, not the default.

## Purchasing domain

### Supplier debt (`debtService.js`)
- Every purchase invoice approval and every payment inserts one row into
  `supplier_transactions` with a `balance_after` snapshot, and updates
  `suppliers.current_balance` to match. The two must never drift — if you add
  a new way to move supplier debt, update both in the same transaction.
- Debt aging (`GET /api/suppliers/aging`) buckets by invoice age, not
  payment age.

### Product matching (`productMatcher.js`)
- OCR-extracted line items are matched to canonical products via
  `product_aliases` (normalized-name lookup) first, then fuzzy match, then
  fall to `NewProduct`/`Pending` for human review.
- `confirmMatch(ocrName, productId)` **only writes an alias row** — it does
  not touch `purchase_invoice_items`. The current invoice's own line item is
  updated separately by the caller, scoped to that specific item's id. This
  was a real bug: an earlier version ran an unscoped
  `UPDATE purchase_invoice_items SET product_id = ? WHERE normalized_ocr_name = ?`,
  which silently repointed every historical item across unrelated invoices
  that happened to share the same OCR text. Never reintroduce a
  cross-invoice `UPDATE` keyed only on normalized text.
- `product_aliases.normalized_alias` is **globally unique**, not scoped per
  supplier. Two different suppliers calling the same product by the same
  OCR-normalized name is treated as the same alias. Known limitation — see
  `roadmap.md`.

### Stock (`stockService.js`)
- Current stock is **never** a stored column — always
  `SUM(stock_movements.quantity) WHERE product_id = ?`. See `database.md` for
  why `products.current_stock` exists but must not be read or written.
- Low-stock threshold check: `getLowStockProducts(threshold = 10)` — filters
  via the corrected `HAVING COALESCE(SUM(sm.quantity),0) < ?` (see
  `database.md`'s SQLite footgun writeup for why this had to be phrased this
  way).

### Purchase Orders (`purchaseOrderService.js`)
- A PO is **intent only** — creating, sending, or receiving a PO has **no**
  effect on `stock_movements`, `supplier_transactions`, or
  `accounting_transactions`. Only an actual approved purchase invoice moves
  stock/debt/accounting.
- Status lifecycle: `Draft → Sent → Received` or `Draft/Sent → Cancelled`.
  `VALID_STATUSES = ['Draft','Sent','Received','Cancelled']`.
  `TERMINAL_STATUSES = ['Received','Cancelled']` — once a PO reaches either,
  `updateStatus` rejects further transitions.
- **UX default, not a data rule**: when adding a product line to a new PO,
  the unit-price field is pre-filled from that product's
  `last_purchase_price` (falling back to `average_cost`) purely as a
  starting value — the user can freely edit it before submitting. The
  prefill only fires if the price field is currently empty, so it never
  clobbers a value the user already typed. See
  `desktop/src/modules/purchase-orders/components/CreatePOSheet.tsx`.

### Double-entry accounting (`accountingService.js`)
- Every accounting-relevant event posts matched debit/credit rows to
  `accounting_transactions`. `GET /api/accounting/verify-balance` asserts
  `SUM(debit) === SUM(credit)` across the whole ledger — if this ever fails,
  it means a code path posted an unbalanced entry, which is a hard bug, not
  a data-entry issue.
- Accounting only covers the **purchasing** side (COGS, inventory, accounts
  payable, purchases, discounts, tax). Sales-side revenue/receivables are
  explicitly **out of scope** — see next section.

## Sales domain (Wholesale Customers)

This domain was built with hard constraints stated up front, all still true
in the shipped code:

- **Must never touch** inventory/stock, COGS, profit, double-entry
  accounting, or supplier logic. `sales_invoice_items.product_name` is free
  text with no FK to `products` specifically so this domain can't
  accidentally start depending on the catalog.
- **Customer balance is never a stored column.** It is always computed as
  `SUM(sales_invoices.invoice_amount) − SUM(customer_payments.amount)` for
  that customer, via a correlated subquery (see `database.md`). This is a
  deliberate departure from the supplier side's snapshot-column approach —
  intentional, not an inconsistency to "fix."
- **Payments are never allocated to a specific invoice.**
  `customer_payments` has no `invoice_id` column at all. A payment reduces
  the customer's overall account balance, full stop — there is no concept of
  "this payment paid off invoice #4."
- **Invoice `previous_balance`/`new_balance` are frozen historical facts**,
  computed once at invoice-creation time from the customer's balance *at that
  moment* and never recalculated afterward — this is not a duplicate of the
  "no stored balance" rule; it's precedented by `purchase_invoices` doing the
  exact same thing on the purchasing side. Do not "fix" these to be
  live-computed — that would make a printed/historical invoice's footer
  silently change after the fact.
- Invoice numbering: a temporary unique placeholder
  (`TEMP-${Date.now()}-${random}`) is inserted first (to get a real primary
  key inside the same transaction), then updated to the real
  `SINV-${id.padStart(6,'0')}` format once the id is known.
- `recordPayment` validates: customer exists, payment date present, amount
  `> 0`. **(not yet enforced)**: no overpayment guard — a customer can be
  recorded as paying more than their current balance; this was a deliberate
  simplification, not an oversight, since overpayment is a legitimate
  real-world case (credit balance) and the spec didn't ask for a guard.
- The Account Statement (`GET /api/customers/:id/statement`) is always
  regenerated from `sales_invoices` + `customer_payments` via the window-
  function query in `database.md` — never cached, never stored.

## Validation rules (services, "not yet enforced" called out explicitly)

| Rule | Enforced? | Where |
|---|---|---|
| Purchase invoice `UNIQUE(invoice_number, supplier_id)` | Yes — DB constraint | `schema.sql` |
| Sales invoice must have ≥1 item | Yes | `customerService.createInvoice` |
| Payment amount `> 0` | Yes | `customerService.recordPayment`, `debtService` |
| PO status transitions restricted once terminal | Yes | `purchaseOrderService.updateStatus` |
| Overpayment guard (customer can't pay more than owed) | **No** — deliberate | `customerService.recordPayment` |
| Product alias uniqueness scoped per-supplier | **No** — global unique instead | `product_aliases` schema |
| Accounting debit=credit balance | Yes, checked on demand | `GET /api/accounting/verify-balance` |
