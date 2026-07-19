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

### Invoice lifecycle: Pending Review → Approved (`invoiceProcessor.js`)
A purchase invoice has exactly two content-relevant states, and the
transition between them is one-way:

- **Pending Review** — every OCR import lands here, *always*, regardless of
  match confidence or validation result. There is no auto-approve fast
  path. Nothing here is a business record yet: no stock movement, no
  supplier debt, no accounting entry. Every field is directly editable and
  persists immediately on its own request (`PATCH /api/invoices/:id/items/:itemId`,
  `POST .../items`, `DELETE .../items/:itemId`) — there is no "local
  decisions, submit as a batch" step anymore. Editing is always inert: it
  only ever touches `purchase_invoice_items`, never stock/debt/accounting.
- **Approved** — the result of `POST /api/invoices/:id/approve` (no body).
  Requires **every** item to already carry a real `product_id`; rejects
  with a message naming every still-unmatched item otherwise — there is no
  partial approval. On success: `status='Approved'`, then
  `executeBusinessLogic()` posts stock/debt/cost/accounting in one shot.
  **This is the only place those effects are ever posted.**

**The calculated total (sum of line items) is the single source of truth
for `invoice_amount`** — never the OCR-extracted header figure.
`ocr_header_total` stores that raw OCR figure separately, frozen once at
import, purely for reference/validation/display; it is never read by any
business-logic code path. `invoice_amount` is instead kept permanently in
sync with `SUM(purchase_invoice_items.total_price)` — recalculated via
`db.stmts.recalculateInvoiceTotal` at the end of every `updateInvoiceItem`,
`addInvoiceItem`, and `deleteInvoiceItem` call (and therefore through
merge/split too, since those compose the same three primitives). This means
by the time `approveInvoice()` runs, `invoice_amount` already reflects
exactly what's in the items — no special recompute needed at approval time,
and it's what `executeBusinessLogic()` uses for supplier debt and
accounting. Stock movements, weighted-average cost, and product-analytics
purchase history were already item-level (never read the header total), so
this rule was already implicitly true for those — the header figure was
only ever wrong for debt/accounting before this rule was enforced. The
review UI shows OCR Header Total / Calculated Total / Difference together,
with a warning banner (Pending Review only) when they differ by more than a
cent.

**Every OCR-supplied and API-supplied numeric field must go through
`parseNumber()`** (`src/utils/parseNumber.js`) before any arithmetic or
storage — never trust that a "numeric" field from OCR JSON is actually a
JS number. This is not a style preference; it's the fix for a real
incident where a formatted string (`"99,220.00"`) silently corrupted a
supplier's balance via string concatenation instead of addition — see
ADR-017 for the full trace.

Once Approved, the invoice is **permanently immutable** — product name,
quantity, unit, unit price, product match, line items, and totals can never
change again. Every item-editing endpoint checks
`invoiceProcessor._requirePendingInvoice()` first and rejects outright if
`status !== 'Pending Review'`. The **only** exception is `notes`
(`PATCH /api/invoices/:id/notes`), explicitly carved out because it's
metadata, not a financial fact. An Approved invoice behaves like a printed
legal document: view, print, and view its already-posted stock/supplier
effects — never edit.

**Deliberately not implemented (Phase 1 scope):** an "Invoice Correction"
workflow for fixing a mistake discovered *after* approval. That would need
adjustment/reversal transactions that preserve accounting history rather
than mutating a posted record in place — a materially different, larger
feature. Do not build a workaround for this (e.g., letting the review page
silently patch an approved item) without designing that adjustment-entry
mechanism properly first.

**Merge/split are frontend compositions, not backend primitives** — there's
no dedicated "merge" or "split" endpoint. Merge = `updateInvoiceItem` (sum
quantities into one row) + `deleteInvoiceItem` (remove the other). Split =
`updateInvoiceItem` (shrink the original row's quantity) + `addInvoiceItem`
(a new row for the remainder, carrying over the same product/unit/price).
Both are safe specifically *because* nothing has posted yet pre-approval.

**Manual entry** (`createManualInvoice()`, `POST /api/invoices/manual`) — for
a supplier's handwritten invoice, where there's no OCR JSON to paste. Lands
at `Pending Review` exactly like an OCR import and goes through the exact
same editing/approval pipeline above; the only real differences:
- The supplier is picked directly (`SupplierPicker`), so there's no
  `supplierMatcher` fuzzy-matching step.
- Every item requires a deliberate product decision at entry time — either
  an existing `productId` or `createNewProduct` — so `match_status` is
  always `UserSelected`/`NewProduct`, never `Pending`. There's no OCR
  ambiguity to review afterward.
- `previous_balance`/`new_balance` are computed **live** from
  `debtService.getCurrentBalance()` at creation time, not trusted from OCR
  input — there's no OCR figure to sanity-check here, so the actual current
  balance is used directly rather than accepting a user-typed guess.
- `ocr_header_total` is always `NULL` (nothing to compare the calculated
  total against), and `source = 'manual'` on the row (vs `'ocr'` for the
  OCR path) — purely informational, shown as a badge on the review page.

**Photo attachments** (`invoice_attachments`, `POST /api/invoices/:id/attachments`)
— optional backup documentation for the physical invoice (handwritten or
otherwise), storable at any invoice status, never read by business logic.
Purely reference material for a human to cross-check later, not part of the
approval gate.

### Product catalog editing (`routes/products.js`)
- Only catalog metadata is user-editable: `name`, `barcode`, `category`,
  `unit` (`PATCH /:id`) and the suggested selling price, `default_sale_price`
  (`PATCH /:id/price`, its own endpoint since it's the one price a user sets
  directly).
- `last_purchase_price` and `average_cost` are **never** accepted from a
  request body anywhere — they're system-computed snapshots, written only by
  `updateCost` at invoice approval (see the append-only-ledger exceptions
  above). There is no route that lets a user set them directly, by design.

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
- **Editing is Draft-only**: header fields (supplier, order date, expected
  date, notes) and line items (product, quantity, expected price; add/
  delete) can only be changed while `status === 'Draft'`, enforced by
  `_requireDraft()` at the top of every editing method — 400 otherwise.
  Unlike invoice editing there's no cascade to keep in sync (see the intent-
  only rule above), so editing is just correcting the record itself, no
  stock/debt/accounting side effects at any point. Deleting the last
  remaining item is rejected, same as invoice items.
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

## Expiration Tracking (`expirationService.js`)

Built from a spec with hard constraints stated up front, all still true in
the shipped code:

- **Must never touch** stock/`stock_movements`, purchase-invoice approval,
  or supplier/customer accounting. `expiration_batches.product_id` is the
  **only** foreign key anywhere in this table — no supplier, invoice, or
  stock reference exists, so this module cannot accidentally start
  depending on any of them. This is deliberate, matching the same
  independence discipline as the Sales domain above (free-text
  `sales_invoice_items.product_name` for the same reason).
- **Status is a hybrid, never a single stored truth**:
  - `ACTIVE`, `NEAR_EXPIRY`, `EXPIRED` are pure functions of
    `expiration_date` vs. today and are **always recomputed live** by every
    read query — the stored `status` column is never trusted for these
    three. Same "don't trust a value that drifts from reality" principle as
    `products.current_stock` (see `database.md`).
  - `DISCARDED`, `SOLD` are **terminal, user-set actions** with no date
    logic — set via `PATCH /:id/status`, and they override the date-derived
    computation until explicitly cleared back to `'ACTIVE'` (which resumes
    live date-based tracking, it does not mean "the batch is currently
    fine" as a literal claim).
  - The date-derived values are **never accepted** as a `PATCH /:id/status`
    body — only `ACTIVE`/`DISCARDED`/`SOLD` are settable; anything else is
    a 400.
- **A batch's product is immutable after creation.** `PATCH /:id` has no
  `productId` in its accepted fields at all — enforced by the SQL simply
  never including that column, not a runtime rejection.
- **No supplier filter on the batch list**, even though the original spec
  suggested one as optional — deriving a batch's supplier would require
  joining through purchase-invoice history, which directly violates this
  module's own independence rule. Product/category/status/expiration-date
  filters cover the real use cases instead.
- **Export is CSV-only** (the shared `DataTable`'s existing one-click
  export) plus the existing `window.print()` pattern for a PDF — no new
  spreadsheet dependency was added for a native `.xlsx` file.
- **"Notify on app start"** is a dashboard-summary fetch + toast fired once
  per app session from `AppShell.tsx` (`useExpirationStartupAlerts`), not a
  new push-notification or background-job subsystem — this app has neither,
  and building one wasn't asked for.
- Future compatibility: a future "Purchase Invoice Approved → auto-create
  batch" integration was explicitly designed for but not built — it would
  call `expirationService.createBatch()` the same way a user's manual entry
  does, requiring no schema change, since the table already stands alone.

## Settings (`settingsService.js`)

- **Business profile is a single row, never a list.** `business_profile.id`
  is constrained to `1` at the schema level (`CHECK (id = 1)`) — there is
  exactly one business identity, not a multi-tenant concept. It is not
  currently read by any invoice/report print template; this only stores the
  data, wiring it into print headers is a deliberate follow-up, not done here.
- **Backup always checkpoints WAL first** (`db.pragma('wal_checkpoint(FULL)')`)
  before the file is downloaded. In WAL mode recent writes live in
  `invoices.db-wal`, not the main file — skipping the checkpoint could hand
  back a backup that's silently missing the newest data.
- **Restore never destroys the current database.** The live file is
  *renamed* to `invoices.db.before-restore-<timestamp>` (kept, not deleted)
  before the uploaded file takes its place. A mistaken restore is always
  recoverable by hand from that file.
- **Restore does not hot-swap the live connection.** `config/database.js`
  opens its `better-sqlite3` connection exactly once, at process start, as a
  long-lived singleton — swapping the underlying file out from under an
  already-open connection is unsupported territory, not attempted here.
  `POST /api/settings/restore` responds `{ requiresRestart: true }`; the
  restored file only takes effect the next time the app (and its backend
  child process) starts fresh.
- **Restore validates the SQLite file header** (the first 16 bytes must
  equal `"SQLite format 3\0"`) before touching anything — an invalid upload
  is rejected and deleted without ever renaming the live database aside.
- **No data-reset feature.** Explicitly scoped out — this is backup/restore
  only, never a way to wipe transactional data while keeping the app
  installed.

## Validation rules (services, "not yet enforced" called out explicitly)

| Rule | Enforced? | Where |
|---|---|---|
| Purchase invoice `UNIQUE(invoice_number, supplier_id)` | Yes — DB constraint | `schema.sql` |
| Purchase invoice: every item must have `product_id` before approval | Yes | `invoiceProcessor.approveInvoice` |
| Purchase invoice: items immutable once Approved | Yes | `invoiceProcessor._requirePendingInvoice` |
| Purchase invoice: can't delete the last remaining item | Yes | `invoiceProcessor.deleteInvoiceItem` |
| Sales invoice must have ≥1 item | Yes | `customerService.createInvoice` |
| Payment amount `> 0` | Yes | `customerService.recordPayment`, `debtService` |
| PO status transitions restricted once terminal | Yes | `purchaseOrderService.updateStatus` |
| Overpayment guard (customer can't pay more than owed) | **No** — deliberate | `customerService.recordPayment` |
| Product alias uniqueness scoped per-supplier | **No** — global unique instead | `product_aliases` schema |
| Accounting debit=credit balance | Yes, checked on demand | `GET /api/accounting/verify-balance` |
