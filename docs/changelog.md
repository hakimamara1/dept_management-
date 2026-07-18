# Changelog

Chronological log of shipped work, grouped by phase. Not tied to git commits
one-to-one — reflects logical delivery milestones across the session(s) that
built this app. Newest phase last.

## Phase 0 — Original backend (pre-Electron)

Express + better-sqlite3 backend: OCR invoice import pipeline, product/
supplier fuzzy matching, stock movements, supplier debt ledger, double-entry
accounting. Vanilla HTML/CSS/JS frontend (later fully replaced — see Phase 1).

## Phase 0.5 — Product price history

Added `GET /api/products/:id/price-history` and a chart-based price-history
view on the (then still vanilla-JS) frontend, before the Electron rewrite.

## Phase 1 — Electron + React foundation, Dashboard, Products

- Deleted the old vanilla-JS `frontend/` outright (explicit user decision,
  no backup kept).
- Hand-scaffolded `desktop/`: Electron 43 + Vite 7 + React 19 + TypeScript,
  Tailwind v4, hand-written shadcn/ui primitives (ADR-002), Zustand,
  TanStack Query, React Hook Form + Zod, TanStack Table, Recharts, React
  Router (`HashRouter`, ADR-003), Sonner.
  - Resolved version-compatibility issues: pinned `vite` to `^7.3.6`,
    `@vitejs/plugin-react` to `^5.2.0`, `@types/react-dom` to `^19.2.3`.
- Electron main process spawns the existing Express backend as a child
  process, polls `/health` (ADR-001) — no rewrite of backend logic.
- Built the shared layer (`api-client`, `query-client`+`queryKeys`, `i18n`,
  `ui-store`, shadcn primitives, `DataTable`, `StatCard`/`PageHeader`/
  `EmptyState`/`ErrorState`/`LoadingState`).
- Built `AppShell`/`Sidebar`/`Topbar`.
- Built the Dashboard module (`StatCardGrid`, `AttentionPanel`,
  `WhoToCallWidget`, `PurchaseTrendChart` — required adding
  `GET /api/analytics/purchase-trend`).
- Built the Products module (search, create, price-history chart).
- End-to-end verification; updated `README.md` for the new desktop app.

## Phase 2 — Suppliers & Debt, Purchase Orders, Invoices

- Fixed a real production bug: `productMatcher.confirmMatch` no longer runs
  an unscoped cross-invoice `UPDATE` (ADR-012).
- Added Purchase Orders backend (`purchase_orders`/`purchase_order_items`
  tables, `purchaseOrderService.js`, `routes/purchaseOrders.js`).
- Added shared `ProductPicker`/`SupplierPicker` components (the one
  deliberate cross-module exception living in `shared/`).
- Built the Suppliers & Debt module (ledger, aging, payments, adjustments).
- Built the Invoices module (OCR submit view, human-review match-confirm
  flow via `InvoiceReviewPage`).
- Built the Purchase Orders module (list, detail, create sheet with
  `useFieldArray` line items).
- Wired routes, nav items, i18n namespaces, query keys for all three
  modules; end-to-end verification.

## Phase 3 — PO price default, Payments, Reports

- Added the UX default: PO line-item price field pre-fills from the
  product's last purchase cost, editable, only when empty (ADR-010).
- Built the Payments module (cross-supplier payment ledger view backed by
  `GET /api/payments`).
- Built the Reports module (trial balance / balance sheet / P&L / balance-
  verification badge, all against `/api/accounting/*`).
- Wired routes/nav for both; typecheck + build clean.

## Phase 4 — Dashboard bug fix

- Diagnosed and fixed the Dashboard's "يحتاج إلى إجراء" (needs attention)
  panel showing every product as low-stock: two independent bugs —
  `stockService` referencing an unimported `QUERIES` object (crash), and
  once fixed, a SQLite `HAVING`/column-alias collision in
  `products.getLowStock` that made the filter a no-op (ADR-011). Verified
  via isolated repro scripts and a live endpoint check; confirmed via grep
  it was the only `HAVING` clause in the codebase.

## Phase 5 — Wholesale Customer Management Module

Fully independent sales-side domain, built to an explicit spec with hard
constraints (see `business-rules.md` for the constraints, ADRs 006–009 for
the specific data-model decisions):

- Schema: `customers`, `sales_invoices`, `sales_invoice_items`,
  `customer_payments` (append after the existing Purchase Orders block in
  `schema.sql`), plus three indexes.
- Backend: `customers`/`salesInvoices`/`customerPayments` query namespaces
  in `queries.js`, matching prepared-statement registrations in
  `config/database.js`, `services/customerService.js`, `routes/customers.js`
  (mounted at `/api/customers` in `app.js`).
- Verified backend end-to-end via `curl`: create customer → create
  multi-item invoice → confirm frozen previous/new balance → record partial
  payment → confirm statement running balance → confirm computed balance →
  confirm reports summary.
- Shared additions: `Customer`/`SalesInvoice*`/`CustomerPayment`/
  `CustomerStatementEntry`/`CustomerReportsSummary` types, `customers` query-
  key namespace, `customers` i18n namespace, new nav item (`/customers`,
  inserted after Suppliers).
- Frontend module: `desktop/src/modules/customers/` — list/detail/sales-
  invoice-detail pages, create-customer dialog, create-sales-invoice sheet
  (free-text line items, no `ProductPicker` — ADR-007), record-payment
  dialog, account-statement view, in-module reports sub-tab (largest
  debtors, most active, totals).
- Print support for sales invoices via `window.print()` (no Electron IPC
  needed — Chromium renderer already supports it) plus `print:hidden` added
  to `AppShell`'s `Sidebar`/`Topbar`.
- Typecheck + build verified clean; lighter browser sanity pass (backend
  curl coverage treated as primary correctness evidence for this phase, per
  explicit user direction to stop exhaustive UI click-through testing).

## Phase 6 — Persistent documentation system

Established `docs/` as the standing source of truth (ADR-013): this file,
plus `architecture.md`, `database.md`, `business-rules.md`, `api.md`,
`import-flow.md`, `reporting.md`, `roadmap.md`, `decisions.md`,
`project-summary.md` — all written and verified against the live codebase
rather than reconstructed from memory. `README.md` updated to match.

## Phase 7 — Two-state invoice workflow (Pending Review / Approved)

Redesigned the purchase-invoice review flow per an explicit ERP-workflow
spec (ADR-014):

- Removed the auto-approve fast path — every OCR import now always lands
  at `Pending Review`, regardless of match confidence.
- Added `purchase_invoice_items.unit` (migration) so unit-of-measure is a
  correctable per-line field, not just inherited from the matched product.
- New endpoints: `PATCH/POST/DELETE /api/invoices/:id/items[/:itemId]`
  (correct name/quantity/unit/price, resolve to an existing or brand-new
  product, add a missing line, delete a wrong one) — all rejected once the
  invoice is no longer Pending Review; `PATCH /api/invoices/:id/notes` (the
  one field still editable post-approval).
- `approveInvoice` redesigned: no more `decisions` body — requires every
  item to already carry a real `product_id`, rejects naming the unmatched
  ones otherwise, then locks the invoice and posts stock/debt/accounting
  exactly as before.
- Frontend: replaced the old card-based, decision-batching review UI with
  `InvoiceItemsTable` — a fully inline-editable table for Pending Review
  (including frontend-composed merge and split, built from the same
  update/add/delete primitives) and a plain read-only table once Approved,
  plus a notes editor and a print button for the locked state.
- Typecheck and build verified clean.

## Phase 8 — Dedicated read-only view page for Approved invoices

- Added `purchase_invoices.approved_at` (migration), stamped once by a new
  `approveInvoiceStatus` statement at the moment `approveInvoice()` succeeds.
- New `InvoiceViewPage.tsx` at `/invoices/:id` (ADR-015) — header (incl.
  approval date, optional average OCR confidence), a sortable/searchable/
  paginated read-only `DataTable` of items (product name, matched product,
  unit, quantity, price, line total, match status — no action column at
  all), a summary card (subtotal, total, item/matched/new-product/existing-
  product-matched counts), a supplier-info card, and print/export-PDF/back
  buttons. Redirects to `/review` if the invoice isn't actually Approved.
- Added a "عرض" action to the Approved tab of the Invoices list, which had
  no way to open an approved invoice at all before this.
- Typecheck and build verified clean.

## Phase 9 — Calculated total as the single source of truth (ADR-016)

- Added `purchase_invoices.ocr_header_total` (migration) — the raw OCR
  figure, frozen at import, reference-only.
- `invoice_amount` now always equals `SUM(purchase_invoice_items.total_price)`,
  recalculated on every item add/edit/delete via a new
  `recalculateInvoiceTotal` statement, and computed from the items
  themselves (not copied from the OCR header) at import time.
- Review page (Pending Review) and view page (Approved) both display OCR
  Header Total / Calculated Total / Difference; the review page additionally
  shows a warning banner when they differ by more than a cent.
- Typecheck and build verified clean.

## Phase 10 — Draft-only editing for Purchase Orders (ADR-018)

- Backend: `purchaseOrderService.js` gained `updateOrder`, `updateOrderItem`,
  `addOrderItem`, `deleteOrderItem`, each gated by a new `_requireDraft(id)`
  guard (400 once the PO isn't Draft). New routes: `PATCH /:id`,
  `PATCH /:id/items/:itemId`, `POST /:id/items`,
  `DELETE /:id/items/:itemId` (rejects deleting the last remaining item).
- Frontend: `PurchaseOrderDetailPage.tsx` now renders an inline-editable
  header (`SupplierPicker`, order/expected date inputs, notes textarea,
  save-on-blur) and a new `PurchaseOrderItemsTable`/`PurchaseOrderItemRow`
  pair (editable product/quantity/expected-price per line, add-row,
  delete-row) while `status === 'Draft'`; every other status renders the
  original plain read-only card + table, unchanged.
- Verified via curl against a live Draft PO: header update, item update,
  add item, delete item, and the delete-last-item guard all behave as
  expected. Typecheck and build verified clean.
