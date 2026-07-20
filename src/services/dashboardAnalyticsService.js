// services/dashboardAnalyticsService.js
/**
 * Dashboard Analytics Service — read-only aggregates for the redesigned
 * Dashboard. Everything here is SELECT-only against existing tables; no
 * schema changes, no writes, no dependency on debtService/invoiceProcessor/
 * customerService. Kept in its own file so the dashboard's data needs never
 * touch the rest of the business logic.
 *
 * Two known data gaps (no per-invoice paid/unpaid flag, no supplier
 * due-date/credit-limit fields) are worked around with real proxies instead
 * of invented data — see getOutstandingDebts (aging-based) and the
 * suppliersWithOutstandingDebt KPI (replaces "unpaid invoices").
 */
const db = require('../config/database');

// ─── Date range resolution ───
// Turns a range keyword (+ optional custom from/to) into concrete
// {startDate, endDate} (inclusive, YYYY-MM-DD) plus the equivalent-length
// previous period immediately before it, for trend comparisons.
function resolveDateRange(range, from, to) {
    // Local-time YYYY-MM-DD, not toISOString().slice(0,10) — the latter
    // converts to UTC first, which silently shifts the date back a day in
    // any timezone ahead of UTC (e.g. CET) once local midnight crosses the
    // UTC day boundary.
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const addDays = (d, n) => {
        const r = new Date(d);
        r.setDate(r.getDate() + n);
        return r;
    };
    const today = new Date();

    let startDate, endDate;
    switch (range) {
        case 'today':
            startDate = endDate = fmt(today);
            break;
        case 'week':
            startDate = fmt(addDays(today, -6));
            endDate = fmt(today);
            break;
        case 'last_month': {
            const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const lastMonthEnd = addDays(firstOfThisMonth, -1);
            startDate = fmt(new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1));
            endDate = fmt(lastMonthEnd);
            break;
        }
        case '3months':
            startDate = fmt(new Date(today.getFullYear(), today.getMonth() - 2, 1));
            endDate = fmt(today);
            break;
        case 'year':
            startDate = fmt(new Date(today.getFullYear(), 0, 1));
            endDate = fmt(today);
            break;
        case 'custom':
            startDate = from;
            endDate = to;
            break;
        case 'month':
        default:
            startDate = fmt(new Date(today.getFullYear(), today.getMonth(), 1));
            endDate = fmt(today);
            break;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const lengthDays = Math.round((end - start) / 86400000) + 1;
    const prevEnd = addDays(start, -1);
    const prevStart = addDays(prevEnd, -(lengthDays - 1));

    return { startDate, endDate, prevStartDate: fmt(prevStart), prevEndDate: fmt(prevEnd) };
}

function withComparison(currentValue, previousValue) {
    const change = previousValue !== 0
        ? ((currentValue - previousValue) / Math.abs(previousValue)) * 100
        : (currentValue > 0 ? 100 : 0);
    return {
        value: currentValue,
        previousValue,
        changePercent: Math.round(change * 10) / 10,
        direction: currentValue > previousValue ? 'up' : currentValue < previousValue ? 'down' : 'flat'
    };
}

// ─── KPIs ───
function getKpis(range, from, to) {
    const { startDate, endDate, prevStartDate, prevEndDate } = resolveDateRange(range, from, to);

    const totalDebt = Number(db.prepare(`SELECT COALESCE(SUM(current_balance), 0) as v FROM suppliers`).get().v);
    const totalSuppliers = db.prepare(`SELECT COUNT(*) as v FROM suppliers`).get().v;
    const suppliersWithOutstandingDebt = db.prepare(
        `SELECT COUNT(*) as v FROM suppliers WHERE current_balance > 0`
    ).get().v;

    const purchasesInRange = (s, e) => db.prepare(
        `SELECT COALESCE(SUM(invoice_amount), 0) as total, COUNT(*) as count
         FROM purchase_invoices WHERE status = 'Approved' AND invoice_date BETWEEN ? AND ?`
    ).get(s, e);

    const paymentsInRange = (s, e) => Number(db.prepare(
        `SELECT COALESCE(SUM(-amount), 0) as total FROM supplier_transactions
         WHERE transaction_type = 'payment' AND date(created_at) BETWEEN ? AND ?`
    ).get(s, e).total);

    const totalDebtAsOf = (dateStr) => Number(db.prepare(
        `SELECT COALESCE(SUM(amount), 0) as v FROM supplier_transactions WHERE date(created_at) <= ?`
    ).get(dateStr).v);

    const totalPurchasesAsOf = (dateStr) => Number(db.prepare(
        `SELECT COALESCE(SUM(invoice_amount), 0) as v FROM purchase_invoices
         WHERE status = 'Approved' AND invoice_date <= ?`
    ).get(dateStr).v);

    const current = purchasesInRange(startDate, endDate);
    const previous = purchasesInRange(prevStartDate, prevEndDate);
    const avgCurrent = current.count > 0 ? current.total / current.count : 0;
    const avgPrevious = previous.count > 0 ? previous.total / previous.count : 0;

    return {
        range: { startDate, endDate },
        // "Total Supplier Debt" and "Remaining Debt" are the same real
        // number (debt is always "remaining") — one card, not a fake
        // duplicate. Trend = vs. what the total was at the start of the
        // selected period.
        totalDebt: withComparison(totalDebt, totalDebtAsOf(prevEndDate)),
        totalPurchases: withComparison(totalPurchasesAsOf(endDate), totalPurchasesAsOf(prevEndDate)),
        purchasesThisPeriod: withComparison(Number(current.total), Number(previous.total)),
        paymentsThisPeriod: withComparison(paymentsInRange(startDate, endDate), paymentsInRange(prevStartDate, prevEndDate)),
        totalSuppliers,
        suppliersWithOutstandingDebt,
        averageInvoiceValue: withComparison(avgCurrent, avgPrevious)
    };
}

// ─── Debt evolution (global running total over time) ───
function getDebtEvolution(range, from, to) {
    const { startDate, endDate } = resolveDateRange(range, from, to);
    const spanDays = Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1;
    const granularity = spanDays <= 31 ? 'day' : spanDays <= 120 ? 'week' : 'month';
    const bucketExpr = {
        day: `date(created_at)`,
        week: `date(created_at, 'weekday 0', '-6 days')`,
        month: `strftime('%Y-%m-01', created_at)`
    }[granularity];

    // Signed amounts (invoice=+, payment=-, adjustment=±) already encode
    // each transaction's effect on total debt, regardless of which
    // supplier — summing them chronologically gives a correct GLOBAL
    // running balance without needing per-supplier balance_after.
    const baseline = Number(db.prepare(
        `SELECT COALESCE(SUM(amount), 0) as v FROM supplier_transactions WHERE date(created_at) < ?`
    ).get(startDate).v);

    const rows = db.prepare(
        `SELECT ${bucketExpr} as bucket, SUM(amount) as delta
         FROM supplier_transactions
         WHERE date(created_at) BETWEEN ? AND ?
         GROUP BY bucket ORDER BY bucket ASC`
    ).all(startDate, endDate);

    let running = baseline;
    const points = rows.map((r) => {
        running += Number(r.delta);
        return { date: r.bucket, totalDebt: running };
    });

    return { granularity, points };
}

// ─── Debt by supplier (current snapshot — not range-scoped, there is no
// reliable per-supplier balance history to reconstruct a past date) ───
function getDebtBySupplier(limit = 8) {
    const rows = db.prepare(
        `SELECT name, current_balance FROM suppliers WHERE current_balance > 0 ORDER BY current_balance DESC`
    ).all();
    const top = rows.slice(0, limit);
    const otherTotal = rows.slice(limit).reduce((sum, r) => sum + Number(r.current_balance), 0);

    const result = top.map((r) => ({ supplier: r.name, debt: Number(r.current_balance) }));
    if (otherTotal > 0) result.push({ supplier: 'موردون آخرون', debt: otherTotal });
    return result;
}

// ─── Purchase analytics ───
function getPurchaseAnalytics(range, from, to) {
    const { startDate, endDate } = resolveDateRange(range, from, to);
    const spanDays = Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1;
    const granularity = spanDays <= 14 ? 'day' : 'month';
    const bucketExpr = granularity === 'day' ? `invoice_date` : `strftime('%Y-%m', invoice_date)`;

    const perPeriod = db.prepare(
        `SELECT ${bucketExpr} as period, COUNT(*) as invoiceCount, COALESCE(SUM(invoice_amount), 0) as total
         FROM purchase_invoices WHERE status = 'Approved' AND invoice_date BETWEEN ? AND ?
         GROUP BY period ORDER BY period ASC`
    ).all(startDate, endDate);

    const largestInvoices = db.prepare(
        `SELECT pi.id, pi.invoice_number, pi.invoice_date, pi.invoice_amount, s.name as supplier
         FROM purchase_invoices pi JOIN suppliers s ON pi.supplier_id = s.id
         WHERE pi.status = 'Approved' AND pi.invoice_date BETWEEN ? AND ?
         ORDER BY pi.invoice_amount DESC LIMIT 10`
    ).all(startDate, endDate);

    const bySupplier = db.prepare(
        `SELECT s.name as supplier, COALESCE(SUM(pi.invoice_amount), 0) as total, COUNT(*) as invoiceCount
         FROM purchase_invoices pi JOIN suppliers s ON pi.supplier_id = s.id
         WHERE pi.status = 'Approved' AND pi.invoice_date BETWEEN ? AND ?
         GROUP BY pi.supplier_id ORDER BY total DESC LIMIT 10`
    ).all(startDate, endDate);

    const summary = db.prepare(
        `SELECT COUNT(*) as count, COALESCE(SUM(invoice_amount), 0) as total, COALESCE(AVG(invoice_amount), 0) as avg
         FROM purchase_invoices WHERE status = 'Approved' AND invoice_date BETWEEN ? AND ?`
    ).get(startDate, endDate);

    return {
        granularity,
        perPeriod,
        largestInvoices,
        bySupplier,
        averageInvoiceAmount: Number(summary.avg),
        totalInvoiceCount: summary.count,
        totalAmount: Number(summary.total)
    };
}

// ─── Price changes (system-wide version of products.getPriceHistory) ───
// For each product, finds its most recent approved-invoice price vs. the
// one immediately before it (LAG), then keeps only products whose most
// recent change happened within the selected range and actually differs.
function getPriceChanges(range, from, to) {
    const { startDate, endDate } = resolveDateRange(range, from, to);

    const rows = db.prepare(`
        WITH ordered AS (
            SELECT pii.product_id, pii.unit_price, pi.invoice_date, pi.invoice_number,
                   s.name as supplier_name,
                   LAG(pii.unit_price) OVER (
                       PARTITION BY pii.product_id ORDER BY pi.invoice_date, pi.id, pii.id
                   ) as prev_price,
                   ROW_NUMBER() OVER (
                       PARTITION BY pii.product_id ORDER BY pi.invoice_date DESC, pi.id DESC, pii.id DESC
                   ) as rn
            FROM purchase_invoice_items pii
            JOIN purchase_invoices pi ON pii.invoice_id = pi.id
            JOIN suppliers s ON pi.supplier_id = s.id
            WHERE pi.status = 'Approved' AND pii.product_id IS NOT NULL
        )
        SELECT p.name as product, o.supplier_name as supplier,
               o.prev_price as oldPrice, o.unit_price as newPrice,
               o.invoice_date as date, o.invoice_number as invoiceNumber
        FROM ordered o
        JOIN products p ON p.id = o.product_id
        WHERE o.rn = 1 AND o.prev_price IS NOT NULL AND o.prev_price != o.unit_price
          AND o.invoice_date BETWEEN ? AND ?
        ORDER BY ABS(o.unit_price - o.prev_price) DESC
    `).all(startDate, endDate);

    const changes = rows.map((r) => {
        const oldPrice = Number(r.oldPrice);
        const newPrice = Number(r.newPrice);
        const diff = newPrice - oldPrice;
        const percent = oldPrice !== 0 ? Math.round(((diff / oldPrice) * 100) * 10) / 10 : 0;
        return {
            product: r.product,
            supplier: r.supplier,
            oldPrice,
            newPrice,
            diff,
            percent,
            date: r.date,
            invoiceNumber: r.invoiceNumber
        };
    });

    const increased = changes.filter((c) => c.diff > 0);
    const decreased = changes.filter((c) => c.diff < 0);
    const avgOf = (arr) => (arr.length ? arr.reduce((sum, c) => sum + c.percent, 0) / arr.length : 0);

    return {
        changes,
        summary: {
            increasedCount: increased.length,
            decreasedCount: decreased.length,
            avgIncreasePercent: Math.round(avgOf(increased) * 10) / 10,
            avgDecreasePercent: Math.round(avgOf(decreased) * 10) / 10
        }
    };
}

// ─── Outstanding debts (aging-based proxy for "upcoming payments" — no
// due-date/payment-terms concept exists anywhere in the schema) ───
function getOutstandingDebts(limit = 10) {
    const rows = db.prepare(`
        SELECT s.id, s.name, s.current_balance,
               SUM(CASE WHEN pi.invoice_date >= date('now','-30 days') THEN pi.invoice_amount ELSE 0 END) as _0_30,
               SUM(CASE WHEN pi.invoice_date >= date('now','-60 days') AND pi.invoice_date < date('now','-30 days') THEN pi.invoice_amount ELSE 0 END) as _30_60,
               SUM(CASE WHEN pi.invoice_date >= date('now','-90 days') AND pi.invoice_date < date('now','-60 days') THEN pi.invoice_amount ELSE 0 END) as _60_90,
               SUM(CASE WHEN pi.invoice_date < date('now','-90 days') THEN pi.invoice_amount ELSE 0 END) as _90_plus
        FROM suppliers s
        LEFT JOIN purchase_invoices pi ON s.id = pi.supplier_id AND pi.status = 'Approved'
        WHERE s.current_balance > 0
        GROUP BY s.id
    `).all();

    const priorityRank = { high: 0, medium: 1, low: 2 };
    const withPriority = rows.map((r) => {
        let priority = 'low';
        let oldestBucket = '0-30 يوم';
        if (Number(r._90_plus) > 0) { priority = 'high'; oldestBucket = '+90 يوم'; }
        else if (Number(r._60_90) > 0) { priority = 'high'; oldestBucket = '60-90 يوم'; }
        else if (Number(r._30_60) > 0) { priority = 'medium'; oldestBucket = '30-60 يوم'; }
        return { supplier: r.name, amount: Number(r.current_balance), oldestBucket, priority };
    });

    withPriority.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || b.amount - a.amount);
    return withPriority.slice(0, limit);
}

// ─── Recent activity (merged from existing timestamped sources — no
// dedicated activity/audit log table exists) ───
function getRecentActivity(limit = 20) {
    const imported = db.prepare(
        `SELECT invoice_number, created_at as ts, invoice_amount as amount
         FROM purchase_invoices ORDER BY created_at DESC LIMIT ?`
    ).all(limit);

    const approved = db.prepare(
        `SELECT invoice_number, approved_at as ts, invoice_amount as amount
         FROM purchase_invoices WHERE approved_at IS NOT NULL ORDER BY approved_at DESC LIMIT ?`
    ).all(limit);

    const payments = db.prepare(
        `SELECT s.name as supplier, st.created_at as ts, -st.amount as amount
         FROM supplier_transactions st JOIN suppliers s ON st.supplier_id = s.id
         WHERE st.transaction_type = 'payment' ORDER BY st.created_at DESC LIMIT ?`
    ).all(limit);

    const suppliersCreated = db.prepare(
        `SELECT name, created_at as ts FROM suppliers ORDER BY created_at DESC LIMIT ?`
    ).all(limit);

    const priceChanges = getPriceChanges('3months', null, null).changes.slice(0, limit);

    const merged = [
        ...imported.map((r) => ({ type: 'invoice_imported', ts: r.ts, label: `فاتورة #${r.invoice_number}`, detail: Number(r.amount) })),
        ...approved.map((r) => ({ type: 'invoice_approved', ts: r.ts, label: `فاتورة #${r.invoice_number}`, detail: Number(r.amount) })),
        ...payments.map((r) => ({ type: 'payment_recorded', ts: r.ts, label: r.supplier, detail: Number(r.amount) })),
        ...suppliersCreated.map((r) => ({ type: 'supplier_created', ts: r.ts, label: r.name, detail: null })),
        ...priceChanges.map((r) => ({ type: 'price_changed', ts: r.date, label: r.product, detail: r.percent }))
    ]
        .filter((r) => r.ts)
        .sort((a, b) => new Date(b.ts) - new Date(a.ts))
        .slice(0, limit);

    return merged;
}

module.exports = {
    resolveDateRange,
    getKpis,
    getDebtEvolution,
    getDebtBySupplier,
    getPurchaseAnalytics,
    getPriceChanges,
    getOutstandingDebts,
    getRecentActivity
};
