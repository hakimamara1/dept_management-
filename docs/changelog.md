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

## Phase 11 — Product catalog editing + fix the broken sale-price button (ADR-019)

- Backend: fixed `POST /api/products` to use the centralized
  `db.stmts.products.insert` (now `name, barcode, category, unit,
  default_sale_price` — cost fields dropped from the insert signature
  entirely, they start `NULL` and are only ever set by `updateCost`), which
  also fixes `defaultSalePrice` being silently dropped on creation. Added
  `PATCH /api/products/:id` (catalog fields only) and
  `PATCH /api/products/:id/price` (sale price only) — the latter fixes a
  404 reported earlier in the session, where the route had been built once
  and then reverted while its schema/statements survived unused.
- Frontend: new `EditProductDialog.tsx` (name/barcode/category/unit form,
  no price field) opened from a pencil icon on the product name cell in
  `ProductsTable.tsx`; new `useUpdateProduct` hook and `productsApi.update`.
  Renamed the "سعر الشراء" (purchase price) action-column header to "سجل
  الأسعار" (price history) — it only ever opened a read-only history sheet
  and never let anyone set a price.
- Typecheck and build verified clean.

## Phase 12 — Manual invoice entry for handwritten supplier invoices + photo attachments (ADR-020)

- Added `purchase_invoices.source` (`'ocr'`/`'manual'`, migration) and a new
  `invoice_attachments` table (`file_path`, `original_name`, `uploaded_at`).
- Backend: `invoiceProcessor.createManualInvoice()` — mirrors
  `processOcrResult()` but simpler (no OCR validation, supplier already
  known via `SupplierPicker`, every item resolved at entry time via the
  existing `_resolveItemProduct()`), computing `previous_balance`/
  `new_balance` live from `debtService.getCurrentBalance()` instead of
  trusting typed input. New routes: `POST /api/invoices/manual`,
  `POST /api/invoices/:id/attachments` (multer, up to 10 photos/10MB each),
  and `GET /:id/review` now also returns `attachments`. Uploaded photos are
  served statically at `GET /uploads/<file_path>` (added to `.gitignore` —
  private business documents, not committed).
- Frontend: new `ManualInvoiceSheet.tsx` (supplier/date/items form + an
  optional multi-photo file input) triggered next to the existing
  `SubmitInvoiceDialog` on the Invoices page. `InvoiceReviewPage.tsx` now
  shows a "أُدخلت يدوياً" badge for manual invoices, a photo gallery, and an
  always-available "إضافة صورة" button on Pending Review invoices.
- Also fixed a latent bug in `apiClient`'s `request()` while adding
  `postForm`: it always set a JSON `Content-Type` header whenever a body
  was present, which would have broken multipart uploads (no browser-set
  boundary) — now skipped specifically for `FormData` bodies.
- **Note**: this feature was previously believed to exist per task-tracking
  history, but was found completely absent from the codebase during
  investigation — same "wiped by an earlier git reset, task tracker stayed
  stale" pattern seen twice already this session (products
  `default_sale_price`, Purchase Order edit routes). This phase is a
  from-scratch rebuild, not a fix.
- Typecheck and build verified clean.

## Phase 13 — AI photo extraction replaces the paste-OCR-JSON dialog (ADR-021)

- Added `replicate` npm dependency, wired the previously-unused `dotenv`
  dependency (`require('dotenv').config()` at the top of `app.js`), added a
  gitignored `.env` with a `REPLICATE_API_TOKEN=` placeholder.
- New `src/services/aiExtractionService.js` — holds the extraction prompt
  (rules + JSON schema + extraction/validation rules) and
  `extractInvoiceData(imageBuffer, mimeType)`, which calls
  `replicate.run("google/gemini-3.1-pro", ...)` with the image as a
  `data:` URI, strips a possible markdown fence, and parses the result.
- New `POST /api/invoices/extract` (multer, single file, field `invoice`) —
  extracts the data, hands it to the **unmodified**
  `invoiceProcessor.processOcrResult()`, and saves the uploaded photo as an
  `invoice_attachments` row on the created invoice.
- Frontend: `SubmitInvoiceDialog.tsx` (paste-OCR-JSON) deleted, replaced by
  `ExtractInvoiceDialog.tsx` (single-image upload, loading state while the
  AI works). `useSubmitInvoice`/`submitInvoiceSchema` removed, replaced by
  `useExtractInvoice`/`invoicesApi.extract()`. `POST /api/invoices/ocr`
  itself is untouched and still callable directly — only its frontend UI is
  gone.
- Typecheck and build verified clean. Live curl verification against the
  real model is pending — needs `REPLICATE_API_TOKEN` set in `.env` first.

## Phase 13 — Remove invoice attachments + add-supplier form

- Backend: `DELETE /api/invoices/:id/attachments/:attachmentId` (removes
  the file from disk and the `invoice_attachments` row; no status
  restriction, since attachments are reference-only). `POST /api/suppliers`
  (adds a supplier directly at zero balance, rejecting a case-insensitive
  duplicate name) — reuses the existing `db.stmts.insertSupplier` prepared
  statement that `supplierMatcher.findOrCreateSupplier` already used.
- Frontend: each attachment thumbnail on `InvoiceReviewPage.tsx` now has a
  hover-revealed delete button. New `CreateSupplierDialog.tsx` wired into
  `SuppliersPage.tsx`'s page header, mirroring `CreateProductDialog.tsx`'s
  shape.
- Verified via curl: delete removes both the file and the DB row; supplier
  creation, duplicate-name rejection, and missing-name rejection all behave
  as expected. Typecheck and build verified clean.

## Phase 14 — Delete a whole invoice (Pending Review only)

- Deleting a photo attachment (Phase 13) turned out not to be what was
  needed — the actual ask was removing an entire mistakenly-created
  invoice, not just its photo. Added `invoiceProcessor.deleteInvoice()`:
  guarded by the existing `_requirePendingInvoice()` (an Approved invoice
  has already posted stock/debt/accounting — reversing that is a different,
  much riskier operation this does not attempt), deletes attachment files
  from disk, then `invoice_attachments` → `purchase_invoice_items` →
  `purchase_invoices` rows in that order inside one transaction (no
  `ON DELETE CASCADE` in the schema, and Pending invoices never have rows
  in `stock_movements`/`supplier_transactions`/`accounting_transactions` to
  worry about, since those only get written at approval).
- New `DELETE /api/invoices/:id`. Frontend: a "حذف الفاتورة" button (with a
  native `confirm()`, unlike this app's usual no-confirm delete buttons —
  warranted here since it destroys much more than one field) on both
  `InvoiceReviewPage.tsx`'s sticky action bar and each row of
  `InvoicesPage.tsx`'s Pending tab. New `useDeleteInvoice()` hook takes the
  invoice id at `mutate()` time rather than at the hook call, since it's
  used both from a single-invoice page and from a list of many rows.
- Also used this to clean up two invoices from earlier testing that had
  gone permanently blank after their supplier row was lost — a separate,
  still-unexplained data issue flagged to the user, not fixed here.
- Typecheck and build verified clean. Verified via curl: deletes a Pending
  invoice fully (header, items, attachment file); rejects deleting an
  Approved invoice.

## Phase 15 — Expiration Tracking module (independent of inventory/accounting, ADR-020)

- New `expiration_batches` table — `product_id` is the only FK anywhere in
  it; no schema change to any existing table. `status` only meaningfully
  stores the two terminal, user-set values (`DISCARDED`/`SOLD`);
  `ACTIVE`/`NEAR_EXPIRY`/`EXPIRED` are always recomputed live from
  `expiration_date` by the SQL in `queries.js`'s new `expirationBatches`
  namespace (`getAll`/`getById`/`getDashboardSummary`).
- New `src/services/expirationService.js` (CRUD, dashboard summary,
  expiring/expired/discarded reports) and `src/routes/expirationBatches.js`,
  mounted at `/api/expiration-batches` — the only line touched in `app.js`.
  No existing service (`invoiceProcessor`, `stockService`, `debtService`,
  `accountingService`) was modified.
- Frontend: new `desktop/src/modules/expiration/` — `ExpirationPage.tsx`
  (Dashboard/Batches/Reports tabs, mirroring the `SuppliersPage`/
  `ReportsPage` sub-tab pattern), `ExpirationBatchDetailPage.tsx`
  (product/batch info, days remaining, edit/delete/mark-sold/mark-discarded
  actions), `CreateBatchDialog.tsx`/`EditBatchDialog.tsx` (product picker +
  fields, product locked after creation), `BatchStatusBadge.tsx`. New nav
  item ("تتبع الصلاحية"), new routes `/expiration` and `/expiration/:id`.
- `useExpirationStartupAlerts()` wired into `AppShell.tsx` — a dashboard-
  summary check fired once per app session (ref-guarded), toasting
  near-expiry/expired counts on launch. Not a new notification subsystem —
  this app has none — just a cheap query + toast.
- Confirmed with the user and recorded in ADR-020: no supplier filter on
  the batch list (would require depending on purchase-invoice history,
  which the spec's own independence rule forbids); CSV export only, no new
  spreadsheet library.
- Verified via curl: status computed correctly across past/near/far
  expiration dates, `productId` immutable on edit, invalid status
  transitions rejected, dashboard-summary counts, delete. Typecheck and
  build verified clean.

## Phase 16 — Settings: Business Profile + Data Backup/Restore (ADR-021)

- `/settings` flipped from a `comingSoon` stub to a real module — first
  actual settings backend this app has ever had.
- New single-row `business_profile` table (name/address/phone/email/tax
  number/commercial register/logo), seeded once via `INSERT OR IGNORE` in
  `runMigrations()`. Added `pragma()` and `dbPath` to `DatabaseManager`
  (`config/database.js`) — small, consistent additions alongside its
  existing `prepare()`/`transaction()` delegates, needed for the backup/
  restore work below.
- New `src/services/settingsService.js` + `src/routes/settings.js`, mounted
  at `/api/settings`. Backup checkpoints WAL (`wal_checkpoint(FULL)`) before
  downloading the db file — otherwise recent writes sitting in
  `invoices.db-wal` could be missing. Restore validates the SQLite magic
  header, renames the current file aside (never deletes it), and responds
  `{ requiresRestart: true }` rather than trying to hot-swap the live
  connection — see ADR-021 for why.
- Frontend: new `desktop/src/modules/settings/` — `SettingsPage.tsx` (ملف
  الشركة / النسخ الاحتياطي tabs), logo upload reusing the same multer/
  static-serving pattern as invoice attachments, backup download reusing
  `DataTable.tsx`'s existing Blob-URL download technique (no new mechanism).
  Scope deliberately excludes theme/language (already work from the Topbar)
  and alert thresholds (not asked for), and there is no data-reset feature
  (considered, explicitly rejected — export/backup only).
- Verified via curl: business profile CRUD, logo upload, backup produces a
  genuinely complete/valid SQLite file (opened and inspected its table
  list), invalid-file restore correctly rejected. The actual restore-swap
  against the live database was **not** tested end-to-end — doing so would
  swap out real working data outside a controlled test, so it's deferred
  until explicitly requested. Typecheck and build verified clean.

## Phase 17 — Package into installable macOS/Windows builds (docs/packaging.md)

- New `src/config/paths.js` centralizes every writable-data path
  (database, uploads, `.env`) behind a single `APP_DATA_DIR` env var —
  unset in dev (identical repo-relative paths as always), set to Electron's
  `userData` directory in a packaged app. `config/database.js`, `app.js`,
  `routes/invoices.js`, `routes/settings.js`, `services/invoiceProcessor.js`
  all switched from computing their own `path.join(__dirname, ...)` to
  importing from it.
- `app.js` now seeds a placeholder `.env` (commented `REPLICATE_API_TOKEN=`
  template, no real token) at `ENV_PATH` on first run if none exists yet.
- `backend-process.ts`: packaged builds launch the backend via
  `process.execPath` + `ELECTRON_RUN_AS_NODE=1` (Electron's own bundled
  Node) instead of a system `node` install, resolving the entry point from
  `process.resourcesPath` instead of a repo-relative path.
- Added `electron-builder` + `@electron/rebuild`; `desktop/package.json`
  gained a `build` config (`extraResources` bundles the root-level
  `src/`/`node_modules`/`package.json` into `resources/backend/`, excluding
  `src/data/` — a packaged app must never ship the developer's own dev
  database) and `rebuild:native`/`dist`/`dist:mac`/`dist:win` scripts.
  `electron-rebuild`'s own `--module-dir` flag proved unreliable at finding
  a node_modules outside the invoking package's directory in the installed
  version — worked around with a small `desktop/scripts/rebuild-native.js`
  that runs it with the root as cwd instead of fighting the flag.
- Placeholder icon (`desktop/build/icon.png`, generated programmatically —
  a flat brand-teal rounded square with a plain monogram) — swap for real
  artwork later, no other config changes needed.
- Shipped **unsigned** (no Apple Developer/Windows code-signing certificate
  assumed) and **without auto-update** for this first pass — both
  explicitly confirmed trade-offs, not oversights.
- **Verified end-to-end on macOS**: `npm run dist:mac` produced a working
  `.dmg`/`.zip`. Launched the packaged app fresh, confirmed its backend
  health check passes, confirmed `.env` and `data/invoices.db` are created
  under `~/Library/Application Support/spice-erp-desktop` (**not** inside
  the read-only app bundle) with a clean/empty schema, created a real
  product through it, quit and relaunched, confirmed the product persisted.
  Also confirmed the packaged `.app` still works after being moved out of
  `dist/` (copied to the Desktop) — proper relocatable-bundle behavior.
- One real mistake caught during this verification: my first attempt at
  `paths.js` used a single root for both the data directory and `.env`,
  but they were never actually siblings in dev (`.env` lives at the repo
  root, `data/` lives inside `src/`) — dotenv silently looked in the wrong
  place (`src/.env`) until this was caught by checking the dotenv startup
  log line and fixed with two separate root calculations.
- `npm run dist:win` produced a `Spice ERP Setup 0.1.0.exe` on the second
  attempt (first hit a transient NSIS-tooling download timeout, unrelated
  to the point below). **Correction — this installer was actually broken**;
  see Phase 18, which found and fixed the real bug the packaging step was
  silently hiding.

## Phase 18 — Fix broken better-sqlite3 binary in the Windows installer

Installing `Spice ERP Setup 0.1.0.exe` and running the backend manually
surfaced the real bug: `better_sqlite3.node is not a valid Win32
application` / `ERR_DLOPEN_FAILED` — the backend crashed before Express
bound to port 3000, so the renderer showed "Unable to reach server."

- **Root cause, traced in the actual code, not guessed**:
  `desktop/scripts/rebuild-native.js` called `electron-rebuild` with no
  `--platform`/`--arch` flags, so it always rebuilt `better-sqlite3` for
  the **host** (this Mac → macOS/x86_64) — confirmed directly via
  `file node_modules/better-sqlite3/build/Release/better_sqlite3.node` →
  `Mach-O 64-bit bundle x86_64`. `desktop/package.json`'s `extraResources`
  then copies that root `node_modules` **verbatim** into every packaged
  target, mac and Windows alike — it's a plain file copy, not a rebuild.
  electron-builder's own "installing native dependencies" pass (visible in
  its build log) does not catch this either: traced `app-builder-lib`'s
  `installOrRebuild` (`util/yarn.js`) to confirm its scope is `desktop/`'s
  own `package.json` dependency tree — `better-sqlite3` is a **root-level**
  dependency used by `src/`, so electron-builder never touches it.
- **Attempted fix and what it revealed**: made `rebuild-native.js`
  target-aware (`node scripts/rebuild-native.js <platform> <arch>`,
  wired as `rebuild:native:mac`/`rebuild:native:win`), and added
  `desktop/scripts/verify-native-binary.js` — reads the resulting
  `.node` file's magic bytes and fails the build loudly if they don't
  match the target platform, specifically so this bug class can't ship
  silently again. Running the now-correct `npm run dist:win` on this Mac
  immediately hit exactly that guard's purpose: forcing a genuine win32
  target rebuild failed outright —
  ```
  prebuild-install warn install No prebuilt binaries found
    (target=<electron-version> runtime=electron arch=x64 libc= platform=win32)
  node-gyp does not support cross-compiling native modules from source.
  ```
  i.e. **cross-building Windows from macOS for this Electron version was
  never actually possible** — the earlier "successful" Windows build had
  simply kept the host macOS binary the whole time (the same bug,
  invisible until installed and run on real Windows). The stale, broken
  `Spice ERP Setup 0.1.0.exe` from the prior phase was deleted from
  `desktop/dist/` so it can't be mistaken for a working build.
- **Real fix**: build the Windows installer **on Windows**. Added
  `.github/workflows/build-desktop.yml` — a `macos-latest` +
  `windows-latest` matrix, each running its own platform's `npm run
  dist:mac`/`dist:win` natively (no cross-compilation, no dependency on a
  prebuilt binary existing for the exact Electron version), uploading the
  resulting installers as build artifacts. This is now the recommended
  release path; local `dist:win` on macOS remains available only for
  cases where a matching prebuild does happen to exist, and will fail
  loudly via `verify-native-binary.js` rather than silently ship a broken
  `.exe` when it doesn't.
- Also added `restore:native` (root `npm rebuild better-sqlite3`), run
  automatically after every `dist:mac`/`dist:win`, since the rebuild step
  mutates the same root `node_modules` the dev backend (system Node)
  loads — without this, a packaging run would leave `npm run dev` broken
  until manually rebuilt.
- **Not yet verified on a real Windows machine** (none available in this
  environment) — the fix is architecturally sound and the CI workflow
  builds natively where the bug can't recur, but an actual install-and-launch
  test on Windows hardware/VM, or a successful CI run, is the remaining
  step to fully close this out.
