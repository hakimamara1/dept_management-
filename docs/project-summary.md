# Project Summary

> **Read this file first.** It's written so a fresh Claude Code session (or a new
> engineer) can understand the project and start contributing without reading
> chat history. Everything here is kept in sync with the code — if this file and
> the code disagree, the code is right and this file is stale; fix the file.

## What this is

An offline-first **desktop ERP** for a wholesale/retail business trading in
Algerian dinar (`دج`). Two independent domains live side by side:

1. **Purchasing side** (original scope): ingest OCR-extracted supplier invoices,
   match products/suppliers, track stock, supplier debt, and double-entry
   accounting.
2. **Sales side** (added later, deliberately decoupled): manage wholesale
   customers, issue them sales invoices, record payments against their account,
   print invoices, run a statement/ledger.

The two domains share a database file and an Express server, but no tables,
services, or business logic between them. See [`business-rules.md`](business-rules.md)
for the exact boundary.

UI language: Arabic (RTL), with French/English scaffolded (see `shared/lib/i18n.ts`).

## Tech stack

| Layer | Choice | Why (see `decisions.md` for the full ADR) |
|---|---|---|
| Desktop shell | Electron 43 | Spawns the backend as a local child process; renderer talks to it over plain HTTP — no IPC data path |
| Backend | Node.js + Express 5 | Simple, synchronous-friendly, already proven in the original codebase |
| Database | SQLite via `better-sqlite3` | Synchronous API, WAL mode, no async ceremony for a single-user desktop app |
| Frontend | React 19 + TypeScript + Vite | Feature-based modules, not built on Electron IPC |
| Styling | Tailwind v4 + hand-written shadcn/ui primitives | CLI wasn't used (see `decisions.md`) — components are copied source, not a package |
| Server state | TanStack Query | Every module's `hooks/` folder |
| UI state | Zustand | Sidebar, theme, language — nothing else needed one yet |
| Forms | React Hook Form + Zod | Every create/edit form in every module |
| Tables | TanStack Table via a shared `DataTable` component | One implementation, reused everywhere |
| Charts | Recharts | Dashboard purchase trend, product price history |
| Routing | React Router, `HashRouter` mode | Required for a packaged Electron renderer (no server to route against) |

## Repository layout

```
dept_managment/
├── src/                    # Express backend (untouched module boundary rules apply)
│   ├── app.js               # Route mounting — see api.md for the full list
│   ├── config/database.js   # better-sqlite3 setup + ALL prepared statements
│   ├── models/
│   │   ├── schema.sql        # Full DDL — see database.md
│   │   └── queries.js         # Every SQL string in the app, centralized
│   ├── routes/                # Thin HTTP handlers, one file per resource
│   └── services/               # Business logic — see architecture.md
├── desktop/                 # Electron + React app (the actual UI)
│   ├── electron/main/         # BrowserWindow + backend child-process spawn
│   └── src/
│       ├── app/                # Providers, router, AppShell/Sidebar/Topbar
│       ├── modules/             # One folder per business module — see below
│       └── shared/               # DataTable, StatCard, api-client, i18n, ui-store, shadcn primitives
├── docs/                    # You are here
├── invoice.json             # Sample OCR payload for /api/invoices/ocr
└── README.md                 # Quick-start / run instructions
```

## Modules — what's built vs. not

| Module | Nav path | Status | Notes |
|---|---|---|---|
| Dashboard | `/` | ✅ Built | Decision-support widgets, not vanity stats |
| Products | `/products` | ✅ Built | Search, create, price-history chart |
| Suppliers & Debt | `/suppliers` | ✅ Built | Ledger, aging, payments, adjustments |
| Customers | `/customers` | ✅ Built | Wholesale customers — see below, independent domain |
| Purchase Orders | `/purchase-orders` | ✅ Built | Intent-only, no stock/debt effects |
| Invoices | `/invoices` | ✅ Built | OCR submit, human-review match-confirm flow |
| Payments | `/payments` | ✅ Built | Cross-supplier payment ledger view |
| Reports | `/reports` | ✅ Built | Trial balance, balance sheet, P&L (accounting side only) |
| Notifications | `/notifications` | ⏳ Not built | `ComingSoonPage` placeholder — no backend concept exists yet |
| AI Assistant | `/ai-assistant` | ⏳ Not built | Same — needs its own scoping pass |
| Settings | `/settings` | ⏳ Not built | Same |

Full detail: [`roadmap.md`](roadmap.md).

## The two ledger domains, side by side

Both domains follow the **append-only ledger** pattern — nothing is ever
UPDATEd to change a balance; a new row is always inserted and the balance is
derived. This is the single most important architectural invariant in the
whole app. See [`business-rules.md`](business-rules.md) for the exact rules.

| | Purchasing (Suppliers) | Sales (Customers) |
|---|---|---|
| Who owes whom | We owe the supplier | The customer owes us |
| Ledger table | `supplier_transactions` | *(none — see below)* |
| Balance storage | `suppliers.current_balance` (maintained snapshot column) | **Not stored** — always `SUM(sales_invoices) − SUM(customer_payments)` |
| Invoice source | External OCR/AI extraction (`/api/invoices/ocr`) | Created manually in-app (`POST /api/customers/:id/invoices`) |
| Payment ↔ invoice link | None (account-level) | None (account-level) — explicit business rule |
| Accounting (double-entry) | Yes (`accounting_transactions`) | **No** — out of scope by design |
| Stock effect | Yes, via `stock_movements` | **No** — out of scope by design |

## How to run it

```bash
# Backend only (API on :3000)
node src/app.js

# Desktop app (spawns the backend itself)
cd desktop
npm install
npm run dev        # Electron + Vite dev server
npm run build       # production build
npx tsc -b --noEmit  # typecheck
```

Full instructions and known packaging gaps: [`README.md`](../README.md).

## Where to look next

- Making a schema change? Read [`database.md`](database.md) first — there's a
  documented SQLite footgun (`HAVING` alias collision) worth knowing before
  writing another aggregate query.
- Adding a business rule? Check [`business-rules.md`](business-rules.md) — don't
  duplicate a rule that already exists elsewhere.
- Adding an endpoint? [`api.md`](api.md) has the full current surface, organized
  by domain, so you can match the existing REST shape.
- Wondering why something was built a certain way? [`decisions.md`](decisions.md)
  is the ADR log — check it before re-litigating a decision.
- Curious what shipped when? [`changelog.md`](changelog.md).
