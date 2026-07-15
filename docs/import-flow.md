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
`status = validation.status` and `validation_errors` as a JSON string. This
happens **before** product matching, so the invoice id exists for item rows
to reference — its `status` gets overwritten below once matching is known.

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

## Phase 5 — Auto-approve or hold for review

```js
finalStatus = (validation.isValid && allMatched) ? 'Approved' : 'Pending Review'
```

If `'Approved'`, `executeBusinessLogic(invoiceId)` runs **immediately**,
inside the same transaction as everything above — an invoice is never left
half-processed. If `'Pending Review'`, nothing downstream happens yet; the
invoice and its items sit with `status='Pending Review'`/`match_status='Pending'`
until a human acts (Phase 7).

`processOcrResult` returns `{ invoiceId, status, supplier, pendingItems, validationErrors, validationWarnings }`.
`pendingItems` is only populated when `status === 'Pending Review'`.

## Phase 6 — `executeBusinessLogic(invoiceId)` (the cascade)

Called from either the auto-approve path above or from human approval
(Phase 7). Re-fetches the invoice + items fresh from the DB (not passed
in-memory) so it behaves identically regardless of caller. Four steps, each
delegated to a dedicated service — **no inline SQL for business effects**,
this method is purely an orchestrator:

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

## Phase 7 — Human review and approval

Frontend: `InvoiceReviewPage` fetches `GET /api/invoices/:id/review` (header +
items with match candidates) for any invoice sitting at `Pending Review`.
The human resolves each pending item and submits decisions to
`POST /api/invoices/:id/approve` with body `{ decisions: [...] }`, each
decision one of:

- `{ action: 'select_existing', itemId, productId }` — confirms this OCR
  name means an existing product. Calls
  `productMatcher.confirmMatch(item.ocr_product_name, decision.productId)`
  (writes **only** a `product_aliases` row — see the bug writeup in
  `business-rules.md` for why it must never touch `purchase_invoice_items`
  directly), then `db.stmts.updateItemProduct.run(productId, 'UserSelected', itemId)`
  updates that specific item row, scoped by its own `itemId`.
- `{ action: 'create_new', itemId, unit }` — `productMatcher.createProductFromOcr(ocrName, {unit})`
  inserts a brand-new `products` row, then the item is linked to it with
  `match_status = 'NewProduct'`.

After all decisions are applied, `approveInvoice` sets
`purchase_invoices.status = 'Approved'` and calls the **same**
`executeBusinessLogic(invoiceId)` used by auto-approval — there is exactly
one code path that produces stock/debt/accounting effects, regardless of
whether approval was automatic or human-reviewed.

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
insert purchase_invoices (status: provisional)
  │
  ▼
for each item: normalize name → matchProduct → insert purchase_invoice_items
  │
  ▼
allMatched && valid? ──yes──▶ status='Approved' ──▶ executeBusinessLogic()
  │no                                                    │
  ▼                                                       ▼
status='Pending Review'                          stock + debt + cost + accounting
  │                                                (all inside the same transaction)
  ▼
human reviews via GET /:id/review
  │
  ▼
POST /:id/approve { decisions }
  │
  ▼
resolve each pending item (alias / new product) ──▶ status='Approved' ──▶ executeBusinessLogic()
```
