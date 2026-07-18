# Import Flow (OCR Invoice Pipeline)

This is the purchasing-side flow that turns a raw OCR/AI extraction of a
supplier invoice into stock movements, supplier debt, and accounting
entries. Entirely orchestrated by `src/services/invoiceProcessor.js`
(`InvoiceProcessor` class, exported as a singleton). Entry point:
`POST /api/invoices/ocr` → `processOcrResult(ocrJson)`.

The whole method runs inside one `db.transaction()` — if anything throws
partway through (duplicate check, insert failure), nothing is committed.

## Input shape

`ocrJson` is expected to look like:
```json
{
  "invoice_number": "...",
  "invoice_date": "DD/MM/YYYY",
  "invoice_time": "...",
  "supplier": { "name": "...", ... },
  "currency": "دج",
  "previous_balance": 0,
  "invoice_amount": 0,
  "discount": 0,
  "tax": 0,
  "new_balance": 0,
  "payment_method": "...",
  "notes": "...",
  "items": [
    { "line_number": 1, "product_name": "...", "package": "...",
      "quantity": 0, "unit_price": 0, "discount": 0, "tax": 0,
      "total_price": 0, "notes": "..." }
  ]
}
```
Dates arrive `DD/MM/YYYY` and are converted to SQLite's `YYYY-MM-DD` by
`parseDate()` before insert.

## Phase 1 — Validate (`validationService.js`)

`validationService.validateInvoice(ocrJson)` returns `{ isValid, status, errors, warnings }`.
`validationService.checkDuplicate(invoiceNumber, supplierName)` — if a match
is found, the whole pipeline **throws immediately** (`Duplicate invoice: <id>`),
rolling back the transaction. No partial invoice is ever created for a
duplicate.

## Phase 2 — Match supplier (`supplierMatcher.js`)

`supplierMatcher.findOrCreateSupplier(ocrJson.supplier || {})` — fuzzy-
matches against existing suppliers by name, or inserts a new one if nothing
matches closely enough. Returns `{ supplier, ...matchInfo }`; `supplier.id`
becomes the invoice's `supplier_id`.

## Phase 3 — Insert invoice header

`db.stmts.insertInvoice.run(...)` writes the `purchase_invoices` row with
`status = 'Pending Review'` (always — see Phase 5) and `validation_errors`
as a JSON string, so `validation.errors` still surface in the review UI even
though they no longer block anything. This happens **before** product
matching, so the invoice id exists for item rows to reference.

## Phase 4 — Match products (`productMatcher.js`)

For each item in `ocrJson.items`:
1. Normalize the OCR product name (`arabicNormalizer.normalizeArabic`).
2. `productMatcher.matchProduct(item.product_name)` → `{ status, suggestedId, confidence }`,
   where `status` is `'Matched'` or something else (alias/fuzzy miss).
3. Insert the `purchase_invoice_items` row regardless of match status —
   `product_id` is only set if `status === 'Matched'`; `match_status` on the
   row is `'Matched'` or `'Pending'`.
4. Anything not `'Matched'` is pushed onto `pendingItems` and flips
   `allMatched = false` for the whole invoice.

## Phase 5 — Always lands at Pending Review

**No auto-approve.** Every OCR import lands at `status = 'Pending Review'`,
regardless of validation result or match confidence — there is no fast path
that skips human review, even for a perfectly-matched invoice. This is a
deliberate ERP-workflow rule (see `business-rules.md`): the business owner
must see and be able to correct every invoice before it becomes a real
business record. Nothing downstream (stock/debt/accounting) runs at this
point — the invoice and its items are a pure draft.

`processOcrResult` returns `{ invoiceId, status: 'Pending Review', supplier, pendingItems, validationErrors, validationWarnings }`.
`pendingItems` lists every item that didn't auto-match with high confidence,
as a hint for the review UI — it's informational only, not a gate.

## Phase 6 — `executeBusinessLogic(invoiceId)` (the cascade)

Called from exactly one place: the end of `approveInvoice()` (Phase 7). This
is now the **only** code path that produces stock/debt/accounting effects —
there is no auto-approve caller anymore. Re-fetches the invoice + items
fresh from the DB (not passed in-memory). Four steps, each delegated to a
dedicated service — **no inline SQL for business effects**, this method is
purely an orchestrator:

1. **Stock** (`stockService.receivePurchase(productId, invoiceId, quantity, unitPrice, reference)`)
   — one call per line item that has a `product_id` (items still `Pending`
   with no `product_id` are skipped and have zero stock/cost effect until
   resolved). Writes a `stock_movements` row and product analytics
   (`analytics.upsert`) for total-purchased/last-purchase-date.
2. **Debt** (`debtService.addInvoiceDebt(supplierId, invoiceId, invoiceAmount, description)`)
   — one call for the whole invoice (not per item): writes a
   `supplier_transactions` row and updates `suppliers.current_balance`.
3. **Weighted average cost** — for each matched item,
   `stockService.getStockWithCost(productId)` computes the current
   quantity-weighted average, then `db.stmts.updateProductCost.run(unitPrice, avgCost, productId)`
   updates `products.last_purchase_price`/`average_cost` (the two
   intentional snapshot-column exceptions to the append-only rule — see
   `business-rules.md`).
4. **Accounting** (`AccountingService.recordPurchaseInvoice(invoiceId, date, amount, discount, tax, description)`)
   — posts the matched debit/credit rows to `accounting_transactions`
   (inventory debit / accounts-payable credit, net of discount/tax).

## Phase 7 — Pending Review editing, then Approve

This is the core of the ERP workflow (full rules in `business-rules.md`).
`InvoiceReviewPage` fetches `GET /api/invoices/:id/review` (header + items)
for any invoice. While `status === 'Pending Review'`, every item field is
directly editable and **persists immediately** — there is no longer a
"local decisions, batch-submit at approve time" model. Each edit is inert:
it updates `purchase_invoice_items` only, nothing downstream ever runs
until the explicit Approve click.

Editing endpoints (`invoiceProcessor.js`), all guarded by
`_requirePendingInvoice()` — every one throws immediately if the invoice
isn't `Pending Review`:

- `PATCH /api/invoices/:id/items/:itemId` → `updateInvoiceItem()` — correct
  `productName`/`quantity`/`unit`/`unitPrice` (any subset), and/or resolve
  the product match via `productId` (existing product — calls
  `productMatcher.confirmMatch()` to write an alias, then sets
  `match_status='UserSelected'`) or `createNewProduct: {unit}` (calls
  `productMatcher.createProductFromOcr()`, sets `match_status='NewProduct'`).
  Recomputes `total_price`. Omitting the product fields entirely leaves the
  existing match untouched — this is how pure text/number corrections work.
- `POST /api/invoices/:id/items` → `addInvoiceItem()` — inserts a new line
  (`line_number` = current max + 1) for a product OCR missed entirely.
- `DELETE /api/invoices/:id/items/:itemId` → `deleteInvoiceItem()` — removes
  an incorrect line; rejected if it's the last remaining item (an invoice
  always needs ≥1 line to be approvable).

Frontend composes **merge** (sum two rows' quantities into one via
`updateInvoiceItem`, then `deleteInvoiceItem` the other) and **split**
(shrink one row's quantity via `updateInvoiceItem`, `addInvoiceItem` a
second row with the remainder, carrying over the same product/unit/price)
entirely from these three primitives — no dedicated backend endpoints for
either, by design (`InvoiceItemsTable.tsx`).

**Approve** (`POST /api/invoices/:id/approve`, no body) → `approveInvoice(invoiceId)`:
1. Requires `status === 'Pending Review'` (can't re-approve, can't approve
   a rejected invoice).
2. Requires ≥1 item and **every** item to already carry a real `product_id`
   — rejects with a message naming every still-unmatched item otherwise.
   There is no partial-approve; an invoice with any leftover unmatched item
   cannot become a business record.
3. Sets `status = 'Approved'`, calls `executeBusinessLogic(invoiceId)`
   (Phase 6) — this is the **only** place stock/debt/accounting ever post.

Once `Approved`, the invoice is permanently locked. None of the editing
endpoints above are reachable against it — `_requirePendingInvoice()`
rejects all of them. The only field that can still change is `notes`, via
the separate `PATCH /api/invoices/:id/notes` (works regardless of status,
but is only meaningful post-approval since notes are also editable while
still Pending Review through the normal item-adjacent form). See
`business-rules.md` for the full "why" behind this immutability rule and
the deliberately-deferred future "Invoice Correction" (adjustment-entry)
workflow.

## Full flow diagram

```
POST /api/invoices/ocr
  │
  ▼
validate + duplicate-check ──(dup)──▶ throw, rollback
  │
  ▼
match/create supplier
  │
  ▼
insert purchase_invoices (status='Pending Review', always)
  │
  ▼
for each item: normalize name → matchProduct (best-effort) → insert purchase_invoice_items
  │
  ▼
GET /:id/review  (human opens the invoice)
  │
  ▼
  ┌─────────────────────────────────────────────┐
  │ PATCH  /:id/items/:itemId  (correct/match)   │  ← repeatable, freely,
  │ POST   /:id/items          (add missing line)│    persists immediately,
  │ DELETE /:id/items/:itemId  (remove bad line) │    zero business effect
  └─────────────────────────────────────────────┘
  │
  ▼
POST /:id/approve
  │
  ├─ any item still missing product_id? ──▶ 400, rejected, stays Pending Review
  │
  ▼ (all matched)
status='Approved' ──▶ executeBusinessLogic()  (stock + debt + cost + accounting)
  │
  ▼
LOCKED — item edits rejected from here on; only notes may still change
```
