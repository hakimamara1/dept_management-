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
rather than reconstructed from memory. `README.md` updated to match
(see next entry once done).
