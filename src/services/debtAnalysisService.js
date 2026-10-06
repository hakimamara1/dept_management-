// services/debtAnalysisService.js
// "Is my debt going up or down, and why?" — read-only analysis over one signed
// ledger per scope (positive amount = debt increases). No schema changes.
//
//   suppliers: supplier_transactions, dated by when it was RECORDED
//              (date(created_at,'localtime')) — the moment the debt really
//              changed, so beginning + flows = ending exactly.
//   customers: sales_invoices (Final only) + customer_payments, with the same
//              sources, signs and business dates as salesInvoices.getStatement,
//              so it reconciles with the existing customer statement/balance.
const db = require('../config/database');
const { resolveDateRange, withComparison } = require('./dashboardAnalyticsService');

const MAX_TRANSACTIONS = 1000;

// Unified ledger: one row per movement.
//   row_id, eid (entity id), ename, d (YYYY-MM-DD), ts (tiebreak), type
//   ('invoice'|'payment'|'adjustment'), amount (signed debt effect),
//   invoice_id, reference, note
function ledgerSql(scope) {
    if (scope === 'suppliers') {
        return `SELECT st.id AS row_id, st.supplier_id AS eid, s.name AS ename,
                       date(st.created_at, 'localtime') AS d, st.created_at AS ts,
                       st.transaction_type AS type, st.amount AS amount,
                       st.invoice_id AS invoice_id, pi.invoice_number AS reference, st.description AS note
                FROM supplier_transactions st
                JOIN suppliers s ON s.id = st.supplier_id
                LEFT JOIN purchase_invoices pi ON pi.id = st.invoice_id`;
    }
    return `SELECT si.id AS row_id, si.customer_id AS eid, c.full_name AS ename,
                   si.invoice_date AS d, si.created_at AS ts,
                   'invoice' AS type, si.invoice_amount AS amount,
                   si.id AS invoice_id, si.invoice_number AS reference, si.notes AS note
            FROM sales_invoices si JOIN customers c ON c.id = si.customer_id
            WHERE si.status != 'Draft'
            UNION ALL
            SELECT cp.id, cp.customer_id, c.full_name,
                   cp.payment_date, cp.created_at,
                   CASE WHEN cp.transaction_type = 'adjustment' THEN 'adjustment' ELSE 'payment' END,
                   CASE WHEN cp.transaction_type = 'adjustment' THEN cp.amount ELSE -cp.amount END,
                   NULL, NULL, COALESCE(cp.notes, cp.payment_method)
            FROM customer_payments cp JOIN customers c ON c.id = cp.customer_id`;
}

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// ── local-date helpers (never toISOString: it shifts the day in UTC+ zones) ──
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

function entityClause(entityId) {
    return entityId ? { sql: ' AND eid = ?', params: [entityId] } : { sql: '', params: [] };
}

function balanceBefore(ledger, date, entityId) {
    const e = entityClause(entityId);
    return round2(db.prepare(`SELECT COALESCE(SUM(amount), 0) AS v FROM (${ledger}) WHERE d < ?${e.sql}`)
        .get(date, ...e.params).v);
}

// Per-day, per-type sums inside [start,end] — everything else is derived from this.
function dailyFlows(ledger, start, end, entityId) {
    const e = entityClause(entityId);
    return db.prepare(
        `SELECT d, type, SUM(amount) AS amt, COUNT(*) AS n FROM (${ledger})
         WHERE d BETWEEN ? AND ?${e.sql} GROUP BY d, type ORDER BY d ASC`
    ).all(start, end, ...e.params);
}

function summarize(beginning, rows) {
    let purchases = 0, payments = 0, adjustments = 0, invoiceCount = 0, paymentCount = 0;
    for (const r of rows) {
        if (r.type === 'invoice') { purchases += r.amt; invoiceCount += r.n; }
        else if (r.type === 'payment') { payments += -r.amt; paymentCount += r.n; }
        else { adjustments += r.amt; }
    }
    purchases = round2(purchases); payments = round2(payments); adjustments = round2(adjustments);
    const ending = round2(beginning + purchases - payments + adjustments);
    const change = round2(ending - beginning);
    return {
        beginning, purchases, payments, adjustments, ending, change,
        changePercent: beginning !== 0 ? Math.round((change / Math.abs(beginning)) * 1000) / 10 : null,
        paymentRatio: purchases > 0 ? Math.round((payments / purchases) * 1000) / 10 : null,
        invoiceCount, paymentCount
    };
}

function periodFigures(ledger, start, end, entityId) {
    const beginning = balanceBefore(ledger, start, entityId);
    return { figures: summarize(beginning, dailyFlows(ledger, start, end, entityId)), beginning };
}

function getAnalysis({ scope, range, from, to, entityId }) {
    if (scope !== 'suppliers' && scope !== 'customers') throw new Error('نطاق التحليل غير صالح');
    const ledger = ledgerSql(scope);
    const { startDate, endDate, prevStartDate, prevEndDate } = resolveDateRange(range, from, to);
    const spanDays = Math.round((parse(endDate) - parse(startDate)) / 86400000) + 1;
    const granularity = spanDays <= 31 ? 'day' : 'month';

    let entity = null;
    if (entityId) {
        const row = scope === 'suppliers'
            ? db.prepare('SELECT id, name FROM suppliers WHERE id = ?').get(entityId)
            : db.prepare('SELECT id, full_name AS name FROM customers WHERE id = ?').get(entityId);
        if (!row) throw new Error(scope === 'suppliers' ? 'المورد غير موجود' : 'العميل غير موجود');
        entity = row;
    }

    const rows = dailyFlows(ledger, startDate, endDate, entityId);
    const beginning = balanceBefore(ledger, startDate, entityId);
    const current = summarize(beginning, rows);
    const previous = periodFigures(ledger, prevStartDate, prevEndDate, entityId).figures;

    const comparison = {};
    for (const k of ['beginning', 'purchases', 'payments', 'adjustments', 'ending', 'change']) {
        comparison[k] = withComparison(current[k], previous[k]);
    }

    // Walk the days once: running debt + per-bucket flows.
    const byDay = new Map();
    for (const r of rows) {
        const o = byDay.get(r.d) || { invoice: 0, payment: 0, adjustment: 0 };
        o[r.type] += r.amt;
        byDay.set(r.d, o);
    }
    const evolution = [];
    const perPeriod = [];
    let running = beginning;
    let bucket = null;
    const flush = (lastDay) => {
        if (!bucket) return;
        evolution.push({ date: bucket.key, debt: round2(running) });
        perPeriod.push({
            period: bucket.key, purchases: round2(bucket.purchases),
            payments: round2(bucket.payments), adjustments: round2(bucket.adjustments)
        });
        bucket = null;
    };
    for (let d = parse(startDate); fmt(d) <= endDate; d = addDays(d, 1)) {
        const day = fmt(d);
        const key = granularity === 'day' ? day : day.slice(0, 7);
        if (!bucket || bucket.key !== key) {
            flush();
            bucket = { key, purchases: 0, payments: 0, adjustments: 0 };
        }
        const o = byDay.get(day);
        if (o) {
            running += o.invoice + o.payment + o.adjustment;
            bucket.purchases += o.invoice;
            bucket.payments += -o.payment;
            bucket.adjustments += o.adjustment;
        }
    }
    flush();

    // Timeline: in-period rows with the running debt after each one.
    const e = entityClause(entityId);
    const txRows = db.prepare(
        `SELECT * FROM (${ledger}) WHERE d BETWEEN ? AND ?${e.sql} ORDER BY d ASC, ts ASC, type ASC, row_id ASC`
    ).all(startDate, endDate, ...e.params);
    let bal = beginning;
    const timeline = txRows.map((r, i) => {
        bal += r.amount;
        return {
            id: i + 1, date: r.d, type: r.type, amount: round2(r.amount), balanceAfter: round2(bal),
            entityId: r.eid, entityName: r.ename, invoiceId: r.invoice_id,
            reference: r.reference, note: r.note
        };
    });
    const transactions = timeline.slice(-MAX_TRANSACTIONS).reverse();

    return {
        scope, entity, granularity,
        range: { startDate, endDate, prevStartDate, prevEndDate },
        current, previous, comparison, evolution, perPeriod,
        transactions, transactionsTruncated: timeline.length > MAX_TRANSACTIONS
    };
}

module.exports = { getAnalysis };
