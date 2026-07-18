# Database

SQLite via `better-sqlite3`, WAL journal mode, foreign keys enforced
(`PRAGMA foreign_keys = ON`). File: `src/data/invoices.db` (there is also a
stray empty `invoices.db` at the repo root — unused, safe to delete, don't
confuse the two). Full DDL: `src/models/schema.sql`, executed idempotently
(`CREATE TABLE IF NOT EXISTS`) on every backend startup.

## Entity-relationship overview

```
suppliers ──< purchase_invoices ──< purchase_invoice_items >── products ──< product_aliases
     │              │                                              │
     │              └──< supplier_transactions                     ├──< stock_movements
     │                                                              └──< product_analytics
     └──< purchase_orders ──< purchase_order_items >── products

purchase_invoices ──< accounting_transactions   (double-entry journal)

customers ──< sales_invoices ──< sales_invoice_items   (product_name is free text — NOT a FK)
     └──< customer_payments
```

Two subgraphs never touch: **products/suppliers/stock/accounting** (purchasing
side) and **customers/sales_invoices/customer_payments** (sales side). No
foreign key crosses between them.

## Tables

### Purchasing domain (original scope)

| Table | Purpose | Key columns |
|---|---|---|
| `suppliers` | Supplier identity | `current_balance` — **maintained snapshot**, updated by `debtService` on every transaction |
| `products` | Canonical product catalog | `current_stock` — **stale, do not read**; always derive stock as `SUM(stock_movements.quantity)` instead (see below) |
| `product_aliases` | Maps every OCR spelling ever seen to a canonical `product_id` | `normalized_alias` is **globally UNIQUE** — known limitation, see `roadmap.md` |
| `purchase_invoices` | Invoice header from OCR | `UNIQUE(invoice_number, supplier_id)`; `status` ∈ `Pending Review, Approved, Rejected`; `approved_at` is `NULL` until `approveInvoice()` sets it once, at the exact moment of approval — powers the read-only view page's "تاريخ الاعتماد" field. `invoice_amount` is **always** `SUM(purchase_invoice_items.total_price)`, kept live by `recalculateInvoiceTotal` on every item add/edit/delete — never read `invoice_amount` as if it were the raw OCR figure. `ocr_header_total` holds that raw OCR figure instead, frozen at import, reference-only — see `business-rules.md` |
| `purchase_invoice_items` | Invoice lines | `match_status` ∈ `Pending, Matched, NewProduct, UserSelected`; `unit` is a per-line, freely-editable unit of measure (independent of whatever the matched product's own canonical unit is), added specifically so it can be corrected pre-approval — see `business-rules.md`'s invoice-lifecycle section. Every column here is directly editable while the parent invoice is `Pending Review`, and permanently frozen once `Approved` |
| `stock_movements` | **Append-only** inventory ledger | `movement_type` ∈ `purchase, sale, adjustment, return`; positive quantity = in, negative = out |
| `supplier_transactions` | **Append-only** debt ledger | `transaction_type` ∈ `invoice, payment, adjustment`; each row snapshots `balance_after` |
| `accounting_transactions` | Double-entry journal | `account_code` ∈ `inventory, accounts_payable, purchases, cash, bank, sales, cogs, discount_received, tax_payable` |
| `product_analytics` | Pre-aggregated totals for the dashboard | Avoids heavy `SUM` queries on every dashboard load |
| `purchase_orders` | Purchase intent (not a financial document) | `status` ∈ `Draft, Sent, Received, Cancelled`; **no stock/debt/accounting effect** |
| `purchase_order_items` | PO line items | `product_id` FKs to the real catalog (unlike sales invoice items — POs are purchasing-side) |

### Sales domain (Wholesale Customers — independent)

| Table | Purpose | Key columns |
|---|---|---|
| `customers` | Customer identity | **No balance column** — see Business Rules |
| `sales_invoices` | Manually-created sales invoice | `invoice_number` auto-generated `SINV-000123`; `previous_balance`/`new_balance` frozen at creation (historical fact, not live) |
| `sales_invoice_items` | Invoice lines | `product_name` is **free text**, deliberately not a FK to `products` |
| `customer_payments` | Payment record | **No `invoice_id` column at all** — payments are never linked to a specific invoice, only to the customer account |

## The "current stock" rule

`products.current_stock` is a real column in the schema but is **never
written to** by any code path. The actual current stock of a product is
always `SUM(stock_movements.quantity) WHERE product_id = ?`. Every service
(`stockService.getCurrentStock`, the dashboard, the low-stock report) derives
it this way. Treat `products.current_stock` as vestigial — don't read it, and
don't "fix" it by writing to it (that would violate the append-only ledger
rule).

## SQLite footgun: `HAVING` and column-alias collisions

**This bit us once — read this before writing another `HAVING`/`GROUP BY`
query.** `src/models/queries.js` → `products.getLowStock` originally read:

```sql
SELECT p.*, COALESCE(SUM(sm.quantity), 0) as current_stock
FROM products p LEFT JOIN stock_movements sm ON p.id = sm.product_id
GROUP BY p.id
HAVING current_stock < ?          -- BUG: silently resolved to p.current_stock (real, always 0)
ORDER BY current_stock ASC        -- fine — ORDER BY does prefer the alias
```

Because `products` has its own real `current_stock` column, and SQLite
resolves a bare identifier in `HAVING`/`WHERE` against real table columns
*before* SELECT-list aliases (even if that column isn't in the SELECT list —
it's still "in scope" via the table), the filter was comparing against the
always-0 stale column and returning every product regardless of threshold.
`ORDER BY` does not have this problem — it resolves aliases correctly.

**Fix**: repeat the aggregate expression in `HAVING` instead of the ambiguous
alias name:

```sql
HAVING COALESCE(SUM(sm.quantity), 0) < ?
```

This is the only `HAVING` clause in the codebase (verified by grep when this
was fixed) — but if you add another one, check for the same class of bug: any
alias name that matches a real column name on a table in scope.

## Aggregate-query rule: correlated subqueries, not multi-table JOINs

When a query needs to aggregate across **two different child tables** of the
same parent (e.g. a customer's total invoices *and* total payments), joining
both child tables in one query and then `GROUP BY`ing causes row fan-out: if
a customer has 3 invoices and 2 payments, the join produces 6 rows before
aggregation, so `SUM(invoice_amount)` gets counted twice per invoice (once
per payment row) and vice versa — both sums come out wrong (multiplied).

The fix used throughout (`customers.getAll`, `customers.getSummary`,
`customers.reports.*` in `queries.js`) is **correlated scalar subqueries**,
one per aggregate, instead of a join:

```sql
SELECT c.*,
  COALESCE((SELECT SUM(invoice_amount) FROM sales_invoices WHERE customer_id = c.id), 0) as total_invoice_amount,
  COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = c.id), 0) as total_payment_amount
FROM customers c
```

Slightly more verbose, always correct. `purchaseOrders.getAll` gets away with
a real join because it only aggregates **one** child table
(`purchase_order_items`) — fan-out isn't possible with a single child table.

## The running-balance ledger pattern (window functions)

`salesInvoices.getStatement` (the Account Statement) is a `UNION ALL` of
invoices (positive amount) and payments (negative amount), ordered
chronologically, with a SQLite window function computing the running total:

```sql
SELECT entry_type, entry_id, entry_date, reference, amount,
  SUM(amount) OVER (
    ORDER BY entry_date, entry_created_at, entry_type, entry_id
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) as balance
FROM ( ...UNION ALL of sales_invoices and customer_payments... )
ORDER BY entry_date, entry_created_at, entry_type, entry_id
```

Note the explicit `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` rather
than relying on the default frame or the `RANGE` frame type — `RANGE` would
give same-day entries (a common case: an invoice and a payment on the same
date) the *same* cumulative value instead of a proper step-by-step ledger.
`ROWS` guarantees one row at a time regardless of ties in the `ORDER BY`.
Nothing about this balance is stored — it's regenerated on every read.

## Schema migrations (adding a column to an existing table)

`schema.sql` runs with `CREATE TABLE IF NOT EXISTS` on every startup —
idempotent for **new** tables, a no-op for a table that already exists on
disk. Adding a column to an already-shipped table (e.g.
`purchase_invoice_items.unit`) needs an explicit migration, since SQLite has
no `ADD COLUMN IF NOT EXISTS`. `config/database.js` runs schema init in
three ordered steps:

```js
this.initSchema();     // CREATE TABLE statements only (indexes deferred)
this.runMigrations();  // ALTER TABLE ADD COLUMN, guarded by PRAGMA table_info
this.initIndexes();    // CREATE INDEX statements, run last
```

The split matters: an index on a column a migration is about to add would
fail if it ran before the migration, since `CREATE TABLE IF NOT EXISTS` is a
no-op on an existing table and the column wouldn't exist yet.
`initSchema()` execs everything up to the literal
`-- Indexes for performance` marker comment; the migration runs; then the
deferred index tail execs last.

**Any future column added to an existing table needs both halves**: add it
to the `CREATE TABLE` block in `schema.sql` (fresh installs) *and* an
`_addColumnIfMissing(table, column, definition)` call in `runMigrations()`
(live databases) — one without the other means dev/prod and fresh installs
silently diverge. Keep the migration list append-only, in the order columns
were introduced.

## Indexes

```sql
idx_aliases_normalized        product_aliases(normalized_alias)
idx_invoices_status            purchase_invoices(status)
idx_invoices_supplier           purchase_invoices(supplier_id)
idx_items_invoice                purchase_invoice_items(invoice_id)
idx_items_product                 purchase_invoice_items(product_id)
idx_stock_product                  stock_movements(product_id)
idx_po_items_po                     purchase_order_items(purchase_order_id)
idx_po_supplier                      purchase_orders(supplier_id)
idx_supplier_trans_supplier           supplier_transactions(supplier_id)
idx_sales_invoices_customer            sales_invoices(customer_id)
idx_sales_invoice_items_invoice         sales_invoice_items(invoice_id)
idx_customer_payments_customer           customer_payments(customer_id)
```

## Adding a table — checklist

1. Add the `CREATE TABLE IF NOT EXISTS` block to `schema.sql`, plus any
   indexes at the bottom of the file (existing convention: all indexes
   grouped at the end, not inline per table).
2. Add query strings to the matching namespace in `queries.js` (create a new
   namespace if it's a new domain).
3. Register prepared statements in `config/database.js` under
   `stmts.<namespace>`.
4. Update this file.
