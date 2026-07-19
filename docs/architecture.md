# Architecture

## High-level shape

```
┌─────────────────────────────────────────┐          ┌──────────────────────────────────┐
│ Electron renderer (Chromium)             │  HTTP    │ Express server (Node child        │
│ desktop/src/                             │ ───────▶ │ process, spawned by Electron's    │
│  app/        providers, router, shell    │ :3000    │ main process on launch)           │
│  modules/*/  feature modules             │          │ src/                              │
│  shared/     DataTable, api-client, i18n │          │  routes/ → services/ → queries.js │
└─────────────────────────────────────────┘          │  → better-sqlite3 → SQLite file   │
        ▲                                              └──────────────────────────────────┘
        │ spawns + health-checks
┌───────┴────────────────────────────┐
│ Electron main process                │
│ desktop/electron/main/               │
│   index.ts            BrowserWindow  │
│   backend-process.ts   child_process │
└───────────────────────────────────────┘
```

**There is no Electron IPC data path.** The renderer talks to the backend over
plain HTTP, exactly like a web app would. Electron's only job is: open a
window, spawn the backend as a local child process, wait for `/health` to
respond, then load the renderer. See `decisions.md` → "Electron IPC vs HTTP
sidecar" for why.

## Backend layers

Every backend feature follows the same five-layer shape, in this order:

1. **`src/models/schema.sql`** — table definitions (DDL). Loaded and executed
   on every startup via `CREATE TABLE IF NOT EXISTS` (idempotent).
2. **`src/models/queries.js`** — every SQL string in the app, centralized and
   namespaced by domain (`suppliers`, `debt`, `products`, `purchaseOrders`,
   `customers`, `salesInvoices`, `customerPayments`, `accounting`, `analytics`,
   `stock`, `invoices`). No SQL string lives anywhere else — this is what
   makes it possible to audit every query in one file.
3. **`src/config/database.js`** — opens the SQLite file, sets pragmas
   (WAL, foreign_keys on), runs `schema.sql`, and **prepares every statement
   from `queries.js` once** into `db.stmts.<namespace>.<name>`. Route/service
   code always calls `db.stmts.x.y.run(...)` / `.get(...)` / `.all(...)`,
   never `db.prepare()` inline (one historical exception was a bug — see
   `decisions.md`).
4. **`src/services/*.js`** — one class (or object) per domain, holding the
   actual business logic: validation, transactions, multi-table orchestration.
   Routes never contain business logic beyond parsing `req.params`/`req.body`
   and calling a service method.
5. **`src/routes/*.js`** — thin Express handlers. Pattern for every one:
   ```js
   router.get('/:id', (req, res) => {
       try {
           const result = someService.getById(parseInt(req.params.id));
           res.json(result);
       } catch (err) {
           res.status(500).json({ error: err.message });
       }
   });
   ```
   Mounted in `src/app.js` under `/api/<resource>`.

**Route-ordering rule**: Express matches routes in registration order. Any
literal single-segment route (like `/aging` or `/reports/summary`) must be
registered *before* a `/:id` route on the same resource, or `/:id` will
swallow it (e.g. a request to `/aging` would bind `id = "aging"`). Every route
file in this repo follows that ordering already — keep it that way when adding
routes.

## Frontend layers (per module)

`desktop/src/modules/<name>/` — every built module has this shape (not every
subfolder is populated if the module doesn't need it):

```
modules/<name>/
  services/<name>.api.ts     # apiClient.get/post/patch wrappers, one function per endpoint
  schemas/*.schema.ts         # Zod schemas + default values for every form
  hooks/                       # TanStack Query hooks — one per query/mutation
  components/                  # Dialogs, Sheets, module-specific UI
  pages/                        # Route-level components
  index.ts                       # Barrel export — only pages are exported, nothing else
```

**Modules never import from each other.** If two modules need the same thing
(a picker, a formatting helper, a type), it goes in `shared/`. The one
deliberate exception: `ProductPicker` and `SupplierPicker` live in
`shared/components/` specifically because both Invoices and Purchase Orders
need them — this was a conscious call, not an accident.

### Shared layer (`desktop/src/shared/`)

- **`lib/api-client.ts`** — thin `fetch` wrapper (`apiClient.get/post/patch`),
  normalizes error responses into `ApiError`.
- **`lib/query-client.ts`** — the `QueryClient` instance **and** a centralized
  `queryKeys` registry. Every module's hooks build their keys from here so
  invalidation stays consistent — never hand-roll a query key array.
- **`lib/i18n.ts`** — hand-rolled i18n (no external library). `ar` is fully
  populated; `fr`/`en` mirror the same keys with real (if less polished)
  translations. Adding a module means adding a namespace here.
- **`store/ui-store.ts`** — the only Zustand store. Holds sidebar-collapsed,
  theme, language. Nothing else has qualified for global UI state yet.
- **`components/ui/`** — shadcn/ui primitives, **hand-written, not
  CLI-generated** (see `decisions.md`). Treat these as owned source, not a
  vendored package — edit them directly when needed.
- **`components/data-table/DataTable.tsx`** — the one TanStack Table
  wrapper every module's list view uses: sorting, column visibility,
  pagination, sticky header, CSV export, optional row selection.
- **`components/StatCard.tsx`, `PageHeader.tsx`, `EmptyState.tsx`,
  `ErrorState.tsx`, `LoadingState.tsx`** — the loading/empty/error/summary
  primitives every page uses.
- **`components/ProductPicker.tsx`, `SupplierPicker.tsx`** — debounced
  search-and-select dropdowns over the existing search endpoints.

### Routing

`app/router.tsx` uses `HashRouter` (not `BrowserRouter`) — required once the
renderer loads from a packaged `file://` path, which has nothing for
`BrowserRouter`'s history API to route against. Every built module's routes
are registered explicitly; unbuilt nav items fall through a
`NAV_ITEMS.filter(item => item.comingSoon)` loop to a shared
`ComingSoonPage`.

## Design patterns actually in use (and ones deliberately not)

**In use:**
- Prepared statements centralized in `config/database.js` (not a repository
  class — see `decisions.md`).
- Append-only ledgers for anything balance-related (`stock_movements`,
  `supplier_transactions`, `accounting_transactions`) — never `UPDATE` a
  balance column directly except the intentional snapshot columns
  (`suppliers.current_balance`, `products.average_cost`/`last_purchase_price`).
- One orchestrator per multi-step business process
  (`invoiceProcessor.processOcrResult()` for the OCR pipeline,
  `customerService.createInvoice()` for sales invoices) wrapped in a single
  `db.transaction()`.
- Feature-based frontend modules, not a `components/`/`hooks/`/`pages/` split.
- Correlated subqueries (not multi-table `JOIN … GROUP BY`) for aggregates
  spanning two child tables of the same parent, to avoid fan-out
  double-counting — see `database.md` for the specific example.

**Deliberately not in use** (don't introduce these without a new ADR):
- Repository pattern / DTO classes — the five-layer shape above already gives
  clean separation without an extra abstraction layer.
- Electron IPC as a data path — HTTP to the local Express server does the job.
- An ORM — `better-sqlite3` + centralized raw SQL is simpler for this app's
  size and keeps every query auditable in one file.
