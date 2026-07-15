# مدير الفواتير — ERP: Purchasing, Stock, Supplier Debt & Wholesale Customers

A Node.js/Express + SQLite backend, with an Electron + React + TypeScript desktop app, covering two independent domains: **purchasing** (OCR-ingested supplier invoices → product/supplier matching → stock movements, supplier debt, double-entry accounting) and **sales** (wholesale customer accounts, manually-issued sales invoices, payments, printable statements).

Currency: `دج` (Algerian Dinar). UI language: Arabic (RTL). Domain: wholesale/retail (oils, groceries, etc. — see `invoice.json` for a sample OCR payload).

> **For full technical documentation, start at [`docs/project-summary.md`](docs/project-summary.md)** — it's kept in sync with the code and is written so a new session/engineer can pick up the project without this README or any chat history. This README is a quick-start; `docs/` is the source of truth for architecture, schema, business rules, API surface, and decision history.

## Contents

- [What this system does](#what-this-system-does)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Data model](#data-model)
- [API reference](#api-reference)
- [Running it locally](#running-it-locally)
- [Project structure](#project-structure)
- [Known gaps / things to fix before production](#known-gaps--things-to-fix-before-production)
- [Documentation](#documentation)

## What this system does

1. **Ingest** — An external OCR/AI step (not part of this repo) turns a photo of a supplier invoice into JSON (see `invoice.json` for the exact shape: invoice header, supplier, line items). That JSON is POSTed to `/api/invoices/ocr`.
2. **Validate** — Required fields, math consistency (`quantity × unit_price ≈ total_price`), balance consistency (`previous_balance + invoice_amount − discount ≈ new_balance`), and duplicate-invoice detection (`invoice_number` + supplier).
3. **Match the supplier** — Exact (case-insensitive) match, then fuzzy match (substring / length-ratio similarity, threshold 0.85), then auto-create.
4. **Match each line item to a product** — Arabic-aware normalization (strips diacritics, unifies alef/ya/kaf variants, strips filler words like "أصلي/عادي") feeding a Jaro-Winkler + token-overlap similarity score, with a learned alias table (`product_aliases`) so repeat OCR spellings resolve instantly.
5. **Auto-approve or route to human review** — If validation passes and every line item matched with high confidence, the invoice is auto-approved. Otherwise it lands in a review queue where a human confirms matches or creates new products (`/api/invoices/:id/approve`).
6. **On approval, cascade the business effects**:
   - **Stock** — an append-only `stock_movements` ledger (never mutate stock directly; current stock is always `SUM(quantity)`).
   - **Supplier debt** — an append-only `supplier_transactions` ledger with a running `balance_after`, mirrored onto `suppliers.current_balance` for fast reads.
   - **Accounting** — double-entry journal entries (`accounting_transactions`): Dr. Inventory / Cr. Accounts Payable, plus discount and input-VAT entries, with an in-code balance assertion (debits must equal credits per invoice).
   - **Product costing** — weighted-average cost recomputed from the stock ledger.
7. **Reporting (purchasing side)** — dashboard stats, low-stock alerts, supplier aging (0-30/30-60/60-90/90+ days), supplier statements, trial balance, balance sheet, and per-invoice journal entries.
8. **Wholesale customers (sales side, independent domain)** — manage customer accounts, issue them manually-created sales invoices, record payments against their account (never allocated to a specific invoice), and view a running account statement. Deliberately decoupled from stock/accounting/supplier logic — a customer's balance is never stored, always computed as `SUM(invoices) − SUM(payments)`. Full rules in [`docs/business-rules.md`](docs/business-rules.md).

## Architecture

```
desktop/ (Electron + React 19 + TS)          src/ (Express API, spawned locally on :3000)
┌─────────────────────────────────┐          ┌───────────────────────────────┐
│ electron/main  → spawns backend,│  fetch() │ app.js  → routes/*.js          │
│   health-checks /health,        │ ────────▶│   → services/ → queries.js     │
│   opens the BrowserWindow       │127.0.0.1 │   → better-sqlite3 → SQLite    │
│ src/modules/*  one folder per   │  :3000   │                                │
│   business module (see below)  │          │                                │
│ src/shared → TanStack Query API │          │                                │
│   client, Zustand ui-store,     │          │                                │
│   shadcn/ui primitives, the     │          │                                │
│   generic DataTable             │          │                                │
└─────────────────────────────────┘          └───────────────────────────────┘
```

There is no Electron IPC data path — the renderer talks to the backend over plain HTTP, exactly like a web app. `invoiceProcessor.processOcrResult()` is the single pipeline every purchase invoice goes through; `executeBusinessLogic()` is the fan-out into stock/debt/accounting, called both on auto-approval and on manual approval so the two code paths stay in sync (see [`docs/import-flow.md`](docs/import-flow.md)).

The desktop app is genuinely offline-first: Electron spawns the same Express/SQLite backend as a local child process on launch (see `desktop/electron/main/backend-process.ts`) rather than talking to anything over the network. Full architecture writeup, including the five-layer backend shape and the per-module frontend shape: [`docs/architecture.md`](docs/architecture.md).

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js, CommonJS |
| HTTP framework | Express 5 |
| Database | SQLite via `better-sqlite3` (synchronous, WAL journal mode, FK enforcement on) |
| Desktop shell | Electron, spawning the Express backend as a local child process |
| Frontend | React 19 + TypeScript + Vite, Tailwind v4 + shadcn/ui (hand-written, not CLI-generated), Zustand (UI state), TanStack Query (server state), TanStack Table, React Hook Form + Zod, Recharts, React Router (`HashRouter`), Sonner |
| Fuzzy matching | Hand-rolled Jaro-Winkler + token-overlap (products), substring/length-ratio (suppliers) |
| File upload | `multer` is a declared dependency but **no upload route currently uses it** — invoices arrive as already-extracted JSON, not images |
| Config | `dotenv` is a declared dependency but **unused** — port (`3000`) and DB path are hardcoded |

## Data model

Core tables (see [`src/models/schema.sql`](src/models/schema.sql) for full DDL):

- **suppliers** — identity + `current_balance` snapshot.
- **products** — canonical catalog + `current_stock`/`average_cost` (the former is documented as derived-only; see gaps below).
- **product_aliases** — maps every OCR spelling ever seen to a canonical `product_id`, with confidence and usage count. This is what makes repeat invoices from the same supplier auto-match instantly.
- **purchase_invoices** / **purchase_invoice_items** — the invoice header and lines, carrying `status` (`Pending Review` / `Approved` / `Rejected`), `match_status` per line, and validation errors as JSON.
- **stock_movements** — append-only ledger; `movement_type` ∈ `purchase|sale|adjustment|return`; current stock = `SUM(quantity)`.
- **supplier_transactions** — append-only debt ledger; `transaction_type` ∈ `invoice|payment|adjustment`; each row snapshots `balance_after`.
- **accounting_transactions** — double-entry journal; `account_code` ∈ `inventory|accounts_payable|purchases|cash|bank|sales|cogs|discount_received|tax_payable`.
- **product_analytics** — pre-aggregated totals to avoid heavy `SUM` queries on the dashboard.
- **purchase_orders** / **purchase_order_items** — purchase *intent*, no stock/debt/accounting effect until an actual invoice is approved.
- **customers** — wholesale customer identity. **No balance column** — always computed as `SUM(sales_invoices) − SUM(customer_payments)`.
- **sales_invoices** / **sales_invoice_items** — manually-created invoices to customers; line items are free text, not FK'd to `products` (this domain never touches the catalog/stock). `previous_balance`/`new_balance` are frozen at creation time.
- **customer_payments** — payments against a customer's account; no `invoice_id` — never allocated to a specific invoice.

Full schema reference, relationships, indexes, and a documented SQLite `HAVING`/alias footgun: [`docs/database.md`](docs/database.md).

## API reference

Base URL: `http://127.0.0.1:3000/api`. Full endpoint-by-endpoint reference, including request bodies and route-ordering notes: [`docs/api.md`](docs/api.md). Summary by domain:

| Domain | Base path | Covers |
|---|---|---|
| Invoices (OCR import) | `/api/invoices` | Submit OCR JSON, human review/approve — see [`docs/import-flow.md`](docs/import-flow.md) |
| Products | `/api/products` | Search, create, price history |
| Suppliers & debt | `/api/suppliers` | List, aging, ledger, statement, payments, adjustments |
| Stock | `/api/stock` | Summary, movements, low-stock, manual adjustment |
| Accounting | `/api/accounting` | Trial balance, balance sheet, P&L, verify, journal |
| Analytics | `/api/analytics` | Dashboard stats, purchase trend |
| Purchase Orders | `/api/purchase-orders` | Intent-only orders, status lifecycle |
| Payments (cross-supplier) | `/api/payments` | Read-only ledger view |
| Customers (wholesale, sales domain) | `/api/customers` | Customers, sales invoices, payments, statement, reports — independent of everything above, see [`docs/business-rules.md`](docs/business-rules.md) |
| Misc | `/health` | Liveness check |

## Running it locally

**Backend only** (API on `:3000`):

```bash
npm install          # already present in node_modules, but for a fresh clone
node src/app.js
```

There is no `npm start` script defined yet — add `"start": "node src/app.js"` to `package.json` if you want one.

**Desktop app** (spawns the backend itself — no need to run it separately):

```bash
cd desktop
npm install
npm run dev            # launches Electron + the Vite dev server
npm run build           # production build (out/main, out/preload, out/renderer)
npm run typecheck        # tsc -b --noEmit across main/preload/renderer
```

`desktop/electron/main/backend-process.ts` spawns `node ../src/app.js` on launch, polls `/health` until it's up, then opens the window — see `docs/architecture.md`. Eight modules are built: Dashboard, Products, Suppliers & Debt, Purchase Orders, Invoices, Payments, Reports, Customers. Notifications, AI Assistant, and Settings route to an honest "coming soon" placeholder rather than a fake screen — see [`docs/roadmap.md`](docs/roadmap.md).

**Packaging note**: dev mode spawns the backend with the system `node`, which is fine for development. A packaged build needs `better-sqlite3` rebuilt against Electron's Node ABI (`@electron/rebuild`) and the child launched via `ELECTRON_RUN_AS_NODE` instead — not set up yet, see [Known gaps](#known-gaps--things-to-fix-before-production).

To try the invoice pipeline end-to-end, POST the contents of [`invoice.json`](invoice.json) to `/api/invoices/ocr` — it's a real sample of the JSON shape the OCR step is expected to produce.

## Project structure

```
src/
  app.js                     Express app + route mounting
  config/database.js         better-sqlite3 setup, pragmas, prepared statements
  models/schema.sql          Full DDL
  models/queries.js          Centralized SQL strings
  routes/                    Thin HTTP handlers, one file per resource
  services/
    invoiceProcessor.js      Orchestrates the OCR → validate → match → approve pipeline
    validationService.js     Field/math/duplicate checks
    supplierMatcher.js       Supplier find-or-create with fuzzy matching
    productMatcher.js        Product matching (aliases → exact → Jaro-Winkler+tokens)
    stockService.js          Stock ledger reads/writes
    debtService.js           Supplier debt ledger reads/writes
    accountingService.js     Double-entry journal
  utils/arabicNormalizer.js  Diacritics/letter-variant/filler-word normalization
  data/invoices.db(-wal/-shm) SQLite database files (WAL mode)
desktop/
  electron/main               BrowserWindow, backend child-process spawn + health check
  electron/preload            Minimal contextBridge (no data IPC — renderer uses HTTP)
  src/app/                    Providers, HashRouter, AppShell/Sidebar/Topbar, ComingSoonPage
  src/modules/                One folder per business module: dashboard, products, suppliers,
                               purchase-orders, invoices, payments, reports, customers
                               (each: services/schemas/hooks/components/pages — see docs/architecture.md)
  src/shared/
    components/ui/            Hand-written shadcn/ui primitives (not CLI-generated)
    components/data-table/    Generic TanStack Table wrapper reused by every module
    components/{ProductPicker,SupplierPicker}.tsx  Shared cross-module pickers
    lib/{api-client,query-client,i18n,format,utils}.ts
    store/ui-store.ts         Zustand: sidebar, theme, language
    types/api.ts               Hand-written mirror of the backend's JSON shapes
docs/                        Persistent technical documentation — start at docs/project-summary.md
invoice.json                 Sample OCR output used as API input
invoices.db                  Stray empty DB file at repo root (unused — the real one is src/data/invoices.db)
```

## Known gaps / things to fix before production

Full detail and reasoning for each of these: [`docs/roadmap.md`](docs/roadmap.md).

- **No authentication or authorization** on any route — anyone who can reach port 3000 can read/write invoices, adjust stock, record payments, and edit accounting entries. Single-user offline-desktop assumption throughout; would need revisiting from scratch for any networked/multi-user deployment.
- **No automated tests** — the matching thresholds, balance math, and double-entry assertions have no regression coverage. Verification so far has been manual (`curl` + browser click-through).
- **`product_aliases.normalized_alias` is globally unique**, not scoped per supplier — the same shorthand text can only ever map to one product across all suppliers, which will misfire if two unrelated products get abbreviated the same way by OCR.
- **Two SQLite files exist** — `invoices.db` at the repo root is empty/unused; the live database is `src/data/invoices.db`. Worth deleting the root one to avoid confusion.
- **`dotenv` and `multer` are installed but not wired up** — port/DB path are hardcoded, and there's no route that accepts an uploaded invoice image, meaning OCR extraction must currently happen entirely outside this codebase.
- **Accounting is purchasing-side only** — the Customers (sales) domain deliberately has no double-entry accounting or stock effect; combined P&L across both domains would be a new design decision, not a bug fix.
- **Customer overpayment has no guard** — a customer can be recorded as paying more than their current balance (deliberate simplification, see `docs/business-rules.md`).
- **No pagination** on most list endpoints (products search caps at 10, suppliers search at 20, but stock summary / trial balance / aging return everything).
- **CORS is wide open** and the desktop app's API base URL is hardcoded to `127.0.0.1:3000` (`desktop/src/shared/lib/api-client.ts`), so this isn't deploy-ready as-is.
- **Electron packaging isn't set up yet** — dev mode spawns the backend with the system `node`; a real packaged build needs `better-sqlite3` rebuilt against Electron's Node ABI (`@electron/rebuild`) and the backend child launched via `ELECTRON_RUN_AS_NODE`, plus an `electron-builder` config. See `desktop/electron/main/backend-process.ts` for the exact spot this plugs into.
- **Notifications, AI Assistant, Settings** aren't built — nav items route to a placeholder. No backend concept exists yet for any of the three; each needs its own scoping pass before code.
- **Backend-already-running edge case** — if a backend is already listening on port 3000 (e.g. left over from manual `node src/app.js` testing) when Electron launches, its own spawned child can end up racing it rather than detecting and reusing the existing instance. Harmless in practice (the existing server keeps serving), but `backend-process.ts` doesn't currently check before spawning.

## Documentation

Full technical documentation lives in [`docs/`](docs/) and is kept in sync with the code — if it ever disagrees with the code, the code is right and the doc is stale (fix the doc). Start at [`docs/project-summary.md`](docs/project-summary.md), then:

- [`docs/architecture.md`](docs/architecture.md) — system shape, backend layers, frontend module shape, patterns in use / deliberately not in use
- [`docs/database.md`](docs/database.md) — full schema, relationships, indexes, a documented SQLite footgun
- [`docs/business-rules.md`](docs/business-rules.md) — validation rules, ledger rules, the purchasing/sales domain boundary
- [`docs/api.md`](docs/api.md) — full endpoint reference by domain
- [`docs/import-flow.md`](docs/import-flow.md) — the OCR invoice pipeline, phase by phase
- [`docs/reporting.md`](docs/reporting.md) — dashboard, reports, and customer-reports widgets
- [`docs/roadmap.md`](docs/roadmap.md) — built vs. not-built, known gaps
- [`docs/decisions.md`](docs/decisions.md) — ADR log for every major implementation choice
- [`docs/changelog.md`](docs/changelog.md) — what shipped, by phase
# dept_management-
