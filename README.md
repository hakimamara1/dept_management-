# مدير الفواتير — Invoice, Stock & Supplier Debt Manager

A Node.js/Express + SQLite backend (with a plain HTML/CSS/JS Arabic RTL frontend) for ingesting OCR-extracted **purchase invoices**, matching their line items to a product catalog and their sender to a supplier record, and cascading the result into **stock movements**, a **supplier debt ledger**, and **double-entry accounting**.

Currency: `دج` (Algerian Dinar). UI language: Arabic (RTL). Domain: wholesale/retail purchasing (oils, groceries, etc. — see `invoice.json` for a sample).

## Contents

- [What this system does](#what-this-system-does)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Data model](#data-model)
- [API reference](#api-reference)
- [Running it locally](#running-it-locally)
- [Project structure](#project-structure)
- [Known gaps / things to fix before production](#known-gaps--things-to-fix-before-production)

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
7. **Reporting** — dashboard stats, low-stock alerts, supplier aging (0-30/30-60/60-90/90+ days), supplier statements, trial balance, balance sheet, and per-invoice journal entries.

## Architecture

```
frontend/ (static HTML/CSS/JS, RTL)         src/ (Express API on :3000)
┌─────────────────────────────┐             ┌───────────────────────────────┐
│ index.html (SPA shell)      │  fetch()    │ app.js  → routes/*.js          │
│ js/api.js  (BASE=:3000)  ───┼────────────▶│   invoices / products /        │
│ js/{dashboard,submit,       │             │   suppliers / stock /          │
│   pending,products,stock,   │             │   accounting / analytics       │
│   suppliers,accounting}.js  │             │        │                       │
└─────────────────────────────┘             │        ▼                       │
                                             │ services/                     │
                                             │   invoiceProcessor (orchestrator)
                                             │   validationService           │
                                             │   supplierMatcher             │
                                             │   productMatcher (fuzzy match)│
                                             │   stockService                │
                                             │   debtService                 │
                                             │   accountingService           │
                                             │        │                       │
                                             │        ▼                       │
                                             │ config/database.js            │
                                             │   (better-sqlite3, WAL)       │
                                             │   models/schema.sql           │
                                             │   models/queries.js           │
                                             └───────────────────────────────┘
```

`invoiceProcessor.processOcrResult()` is the single pipeline every invoice goes through; `executeBusinessLogic()` is the fan-out into stock/debt/accounting, called both on auto-approval and on manual approval so the two code paths stay in sync.

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js, CommonJS |
| HTTP framework | Express 5 |
| Database | SQLite via `better-sqlite3` (synchronous, WAL journal mode, FK enforcement on) |
| Frontend | No framework — static HTML + vanilla JS modules + hand-written CSS, Cairo font, RTL layout |
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

## API reference

Base URL: `http://localhost:3000`

### Invoices
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/invoices/ocr` | Submit OCR-extracted invoice JSON; runs validation → matching → (maybe) auto-approval |
| GET | `/api/invoices/pending` | Invoices awaiting human review |
| GET | `/api/invoices/approved?limit=&offset=` | Paginated approved invoices |
| GET | `/api/invoices/:id/review` | Invoice + line items for the review screen |
| POST | `/api/invoices/:id/approve` | Submit human decisions (`select_existing` / `create_new`) for unmatched lines, then approve |

### Products
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/products/search?query=` | Arabic-normalized name/alias search |
| POST | `/api/products` | Create a product manually |

### Suppliers & debt
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/suppliers?query=` | List / search suppliers |
| GET | `/api/suppliers/aging` | Debt aging report (0-30/30-60/60-90/90+) |
| GET | `/api/suppliers/:id/ledger` | Full transaction ledger |
| GET | `/api/suppliers/:id/statement?startDate=&endDate=` | Filtered statement |
| POST | `/api/suppliers/:id/payments` | Record a payment (updates debt ledger + accounting in one DB transaction) |
| POST | `/api/suppliers/:id/adjust` | Manual balance adjustment |

### Stock
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/stock/summary` | Per-product stock + total inventory value |
| GET | `/api/stock/movements?startDate=&endDate=` | Movements in a date range |
| GET | `/api/stock/movements/:productId` | Full movement history for one product |
| GET | `/api/stock/low?threshold=` | Low-stock alert list |
| POST | `/api/stock/adjust` | Reconcile to a physical count (writes an `adjustment` movement) |

### Accounting
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/accounting/trial-balance` | Debit/credit sum per account |
| GET | `/api/accounting/balance-sheet` | Assets / liabilities / net worth snapshot |
| GET | `/api/accounting/profit-loss?startDate=&endDate=` | Revenue/COGS/purchases (sales side is scaffolded, not wired up yet) |
| GET | `/api/accounting/ledger/:accountCode` | All entries for one account |
| GET | `/api/accounting/verify` | Assert total debits == total credits |
| GET | `/api/accounting/journal/:invoiceId` | Journal entries for one invoice |

### Analytics
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/analytics/dashboard` | Pending/approved counts, total purchases, total debt, product/alias counts, stock value |

### Misc
| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness check |

## Running it locally

```bash
npm install          # already present in node_modules, but for a fresh clone
node src/app.js       # starts the API on http://localhost:3000
```

There is no `npm start` script defined yet — add `"start": "node src/app.js"` to `package.json` if you want one.

The frontend is static and **not served by Express** (no `express.static` in `app.js`). Open [`frontend/index.html`](frontend/index.html) directly in a browser, or serve the `frontend/` folder with any static server (e.g. `npx serve frontend`). `frontend/js/api.js` hard-codes `BASE = 'http://localhost:3000'`, so the API must be running on that exact host/port; CORS is fully open (`cors()` with no origin restriction) so this works from any origin, including `file://`.

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
frontend/
  index.html                 SPA shell (sidebar nav, RTL)
  js/{api,dashboard,submit,pending,products,stock,suppliers,accounting}.js
  css/style.css
invoice.json                 Sample OCR output used as API input
invoices.db                  Stray empty DB file at repo root (unused — the real one is src/data/invoices.db)
```

## Known gaps / things to fix before production

- **No authentication or authorization** on any route — anyone who can reach port 3000 can read/write invoices, adjust stock, record payments, and edit accounting entries.
- **No automated tests** — the matching thresholds, balance math, and double-entry assertions have no regression coverage.
- **`productMatcher.confirmMatch` updates by name, not by row** — it runs `UPDATE purchase_invoice_items SET product_id=... WHERE normalized_ocr_name = ?` with no `invoice_id`/`item_id` scoping, so confirming a match on one invoice will silently repoint *every* historical line item that happens to share the same normalized OCR text, not just the one the user is looking at.
- **`product_aliases.normalized_alias` is globally unique** — the same shorthand text can only ever map to one product across all suppliers, which will misfire if two unrelated products get abbreviated the same way by OCR.
- **Two SQLite files exist** — `invoices.db` at the repo root is empty/unused; the live database is `src/data/invoices.db`. Worth deleting the root one to avoid confusion.
- **`dotenv` and `multer` are installed but not wired up** — port/DB path are hardcoded, and there's no route that accepts an uploaded invoice image, meaning OCR extraction must currently happen entirely outside this codebase.
- **Sales side is scaffolded but not connected** — `AccountingService.recordSale` and `stockService.recordSale` exist, but no route calls them, so the system is purchase-only today.
- **No pagination** on most list endpoints (products search caps at 10, suppliers search at 20, but stock summary / trial balance / aging return everything).
- **CORS is wide open** and the frontend's API base URL is hardcoded to `localhost:3000`, so this isn't deploy-ready as-is.
# dept_management-
