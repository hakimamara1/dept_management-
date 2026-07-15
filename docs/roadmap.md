# Roadmap

## Built

| Module | Status | Notes |
|---|---|---|
| Dashboard | ✅ | Decision-support widgets — see `reporting.md` |
| Products | ✅ | Search, create, price-history chart |
| Suppliers & Debt | ✅ | Ledger, aging, payments, manual adjustments |
| Purchase Orders | ✅ | Intent-only, zero stock/debt/accounting effect until an actual invoice lands |
| Invoices (OCR import) | ✅ | Full pipeline — see `import-flow.md` |
| Payments (cross-supplier view) | ✅ | Read-only ledger; actual writes happen via Suppliers module |
| Reports (accounting) | ✅ | Trial balance, balance sheet, P&L, balance verification |
| Customers (wholesale sales) | ✅ | Fully independent domain — see `business-rules.md` for the boundary |

## Not built

| Module | Status | Notes |
|---|---|---|
| Notifications | ⏳ | Nav item exists, routes to `ComingSoonPage`. No backend concept — needs its own scoping pass (what triggers a notification? low stock? overdue debt? new pending invoice?) before any code |
| AI Assistant | ⏳ | Same — placeholder only |
| Settings | ⏳ | Same — no user/app-level settings exist yet (no auth, no currency/locale config beyond the hardcoded `ar` default) |

## Known gaps / follow-ups

- **Electron packaging — native module rebuild.** `better-sqlite3` is a
  native addon built against the system Node ABI. Dev mode spawns the
  backend with system `node`, which works today, but a *packaged* build
  needs `@electron/rebuild` (or equivalent) to rebuild `better-sqlite3`
  against Electron's ABI, and `ELECTRON_RUN_AS_NODE` to run the backend
  under Electron's bundled Node instead of assuming system Node is present
  on the user's machine. Not yet done — `npm run build` produces a renderer
  bundle but packaging/distribution (`electron-builder` or similar) hasn't
  been wired up.
- **No authentication.** Single-user, offline, trusted-machine assumption
  throughout. Any multi-user or networked deployment would need this
  revisited from scratch — it's not a small addition on top of the current
  design.
- **`product_aliases.normalized_alias` is globally unique**, not scoped per
  supplier (see `business-rules.md`). Two suppliers using the same OCR-
  normalized product name collide into one alias. Not hit in practice yet,
  but worth a schema revisit (`UNIQUE(normalized_alias, supplier_id)`) if it
  ever causes a real mismatch.
- **No automated tests.** Every verification so far has been manual
  (`curl` against the running backend + light browser click-through). No
  unit/integration test suite exists for either `src/` or `desktop/`.
- **Accounting is purchasing-side only.** `accounting_transactions` has no
  concept of sales revenue/receivables from the Customers domain — this is
  a deliberate scope boundary (see `business-rules.md`), not an oversight,
  but if the business ever wants combined P&L across both domains, that's a
  new design decision, not a bug fix.
- **Customer overpayment has no guard.** `customerService.recordPayment`
  allows a payment larger than the customer's current balance (results in a
  negative/credit balance). Deliberate simplification per the original spec,
  documented in `business-rules.md` — revisit only if the business actually
  needs a hard block.
- **`suppliers.current_balance` and `products.average_cost`/`last_purchase_price`**
  are maintained snapshot columns, not append-only-derived. If any future
  code path writes debt or purchase-cost data outside `debtService`/
  `stockService`, these can drift from the underlying ledger — always go
  through the existing services, never write these columns directly.

## Where a new module should start

1. Read `project-summary.md` and `architecture.md` first.
2. Decide: does it belong to the purchasing domain, the sales domain, or is
   it genuinely a third, independent domain? Don't let a new module import
   across that boundary without a real reason and a new ADR.
3. Follow the five-layer backend shape and the `services/hooks/components/pages`
   frontend shape — see `architecture.md` for both.
4. Write the ADR in `decisions.md` for any non-obvious choice before or
   while writing the code, not after.
