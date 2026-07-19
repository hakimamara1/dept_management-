# Reporting & Dashboard

Three separate reporting surfaces, deliberately not unified into one
"reports engine" — each is scoped to its own domain and reads directly off
that domain's live tables (nothing pre-aggregated except
`product_analytics`, which is a performance cache, not a report).

## Dashboard (`/`, `desktop/src/modules/dashboard/`)

Explicitly designed as **decision support, not vanity stats** — every
widget answers "what do I need to do" rather than just restating totals.

| Component | Data source | Purpose |
|---|---|---|
| `StatCardGrid.tsx` | `GET /api/analytics/dashboard` | Four top-line numbers: stock value, total supplier debt, pending invoices, total products |
| `AttentionPanel.tsx` (يحتاج إلى إجراء) | `GET /api/stock/low?threshold=10` + pending invoices | Merges two unrelated data sources — low/out-of-stock products and invoices stuck in human review — into one ranked "do this next" list, each item linking straight to the page that resolves it (`/products` or `/invoices`). This is the panel that had the `HAVING`-alias bug (see `database.md`) — it was silently showing every product as low-stock until fixed |
| `WhoToCallWidget.tsx` (من يجب الاتصال به) | `GET /api/suppliers/aging` | Top 5 suppliers by current balance (descending), flags any supplier whose 90+-day aging bucket still carries a balance |
| `PurchaseTrendChart.tsx` | `GET /api/analytics/purchase-trend` | Recharts line/bar chart of monthly purchase totals |

The dashboard hits four independent endpoints in parallel (`useDashboardStats`,
`useLowStock`, `usePendingInvoices`, `useSupplierAging` — all TanStack Query
hooks in `hooks/useDashboardData.ts`); there is no single "dashboard
payload" endpoint by design, so each widget can loading/error independently.

## Reports module (`/reports`, purchasing/accounting side only)

`desktop/src/modules/reports/pages/ReportsPage.tsx` — three local sub-tabs
(state, not routes), all backed by `/api/accounting/*`:

- **ميزان المراجعة (Trial Balance)** — `GET /api/accounting/trial-balance`,
  rendered as a `DataTable` of every account code with debit/credit/balance.
- **الميزانية العمومية (Balance Sheet)** — `GET /api/accounting/balance-sheet`,
  three `StatCard`s: assets / liabilities / net worth.
- **الأرباح والخسائر (P&L)** — `GET /api/accounting/profit-loss`, four
  `StatCard`s: revenue, COGS, net purchases, gross profit.

A `BalanceVerificationBadge` (top-right, always visible regardless of tab)
polls `GET /api/accounting/verify` and shows green "الدفاتر متوازنة" or red
with the exact imbalance amount — this is the same debit=credit assertion
described in `business-rules.md`, surfaced directly in the UI rather than
only reachable via API.

This module has **no revenue/receivables data** from the Customers domain —
by design, since customer sales are explicitly out of scope for
double-entry accounting (see `business-rules.md`).

## Customer Reports (inside `/customers`, sales side only)

Not a separate route — a second local sub-tab ("التقارير") inside
`CustomersPage.tsx`, next to "كل العملاء", following the exact same
local-tab-button pattern as `SuppliersPage` and `ReportsPage`. Backed by
`GET /api/customers/reports/summary` → `customerService.getReportsSummary()`:

- Four `StatCard`s: total customers, total customer debt, total invoice
  value, average invoice value.
- **أكبر المدينين (Largest debtors)** — top customers by computed balance,
  each linking to `/customers/:id`.
- **الأكثر نشاطاً (Most active)** — customers ranked by combined
  invoice+payment activity count.

All figures here are plain aggregate queries over `sales_invoices` /
`customer_payments` — no accounting, no COGS, no stock, consistent with the
domain's hard boundary.

## Product price history (`/products`)

`GET /api/products/:id/price-history` (see `api.md`) feeds a per-product
Recharts line chart plus a stats block (min/max/avg/first/last/change%/trend)
shown on the product detail view — the earliest reporting feature built in
this project, predating the Electron/React rewrite.

## Adding a new report

Decide which domain it belongs to first — purchasing/accounting
(`/reports`), sales (`/customers` reports sub-tab), or a new
dashboard-style "what needs attention" widget — and follow that domain's
existing pattern rather than introducing a fourth reporting surface. Every
report here is a **read-only aggregate query**, never a stored/pre-computed
table (except the `product_analytics` performance cache) — keep it that way
so numbers can never drift from the underlying ledgers.
