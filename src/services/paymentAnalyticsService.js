// services/paymentAnalyticsService.js
// Read-only analytics over supplier payments (supplier_transactions rows of
// type 'payment'). No schema changes. Payment timestamps are stored in UTC,
// so every date comparison uses date(created_at,'localtime') — otherwise a
// payment made just after local midnight would land on the previous day.
const db = require('../config/database');
const { resolveDateRange, withComparison } = require('./dashboardAnalyticsService');

const PAYMENT_DATE = `date(st.created_at, 'localtime')`;

function supplierClause(supplierId) {
    return supplierId ? { sql: ' AND st.supplier_id = ?', params: [supplierId] } : { sql: '', params: [] };
}

// Payment list, newest first. With no range given this is the old
// unfiltered behaviour (GET /api/payments with no params still returns all).
function getPayments(range, from, to, supplierId) {
    const where = [`st.transaction_type = 'payment'`];
    const params = [];
    if (range) {
        const { startDate, endDate } = resolveDateRange(range, from, to);
        where.push(`${PAYMENT_DATE} BETWEEN ? AND ?`);
        params.push(startDate, endDate);
    }
    if (supplierId) {
        where.push('st.supplier_id = ?');
        params.push(supplierId);
    }
    return db.prepare(
        `SELECT st.*, s.name as supplier_name
         FROM supplier_transactions st
         JOIN suppliers s ON st.supplier_id = s.id
         WHERE ${where.join(' AND ')}
         ORDER BY st.created_at DESC`
    ).all(...params);
}

function paymentStats(startDate, endDate, supplierId) {
    const sup = supplierClause(supplierId);
    const row = db.prepare(
        `SELECT COUNT(*) as count,
                COALESCE(SUM(-st.amount), 0) as total,
                COALESCE(MAX(-st.amount), 0) as largest
         FROM supplier_transactions st
         WHERE st.transaction_type = 'payment' AND ${PAYMENT_DATE} BETWEEN ? AND ?${sup.sql}`
    ).get(startDate, endDate, ...sup.params);
    const total = Number(row.total);
    return { count: row.count, total, average: row.count ? total / row.count : 0, largest: Number(row.largest) };
}

function purchasedTotal(startDate, endDate, supplierId) {
    const params = [startDate, endDate];
    let extra = '';
    if (supplierId) { extra = ' AND supplier_id = ?'; params.push(supplierId); }
    return Number(db.prepare(
        `SELECT COALESCE(SUM(invoice_amount), 0) as v FROM purchase_invoices
         WHERE status = 'Approved' AND invoice_date BETWEEN ? AND ?${extra}`
    ).get(...params).v);
}

function getAnalytics(range, from, to, supplierId) {
    const { startDate, endDate, prevStartDate, prevEndDate } = resolveDateRange(range, from, to);
    const spanDays = Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1;
    const granularity = spanDays <= 31 ? 'day' : 'month';
    const sup = supplierClause(supplierId);

    const cur = paymentStats(startDate, endDate, supplierId);
    const prev = paymentStats(prevStartDate, prevEndDate, supplierId);

    const paidBucket = granularity === 'day' ? PAYMENT_DATE : `strftime('%Y-%m', ${PAYMENT_DATE})`;
    const perPeriodPaid = db.prepare(
        `SELECT ${paidBucket} as period, COALESCE(SUM(-st.amount), 0) as total, COUNT(*) as count
         FROM supplier_transactions st
         WHERE st.transaction_type = 'payment' AND ${PAYMENT_DATE} BETWEEN ? AND ?${sup.sql}
         GROUP BY period ORDER BY period ASC`
    ).all(startDate, endDate, ...sup.params).map((r) => ({ period: r.period, total: Number(r.total), count: r.count }));

    const purchasedBucket = granularity === 'day' ? 'invoice_date' : `strftime('%Y-%m', invoice_date)`;
    const purchaseParams = [startDate, endDate];
    let purchaseExtra = '';
    if (supplierId) { purchaseExtra = ' AND supplier_id = ?'; purchaseParams.push(supplierId); }
    const perPeriodPurchased = db.prepare(
        `SELECT ${purchasedBucket} as period, COALESCE(SUM(invoice_amount), 0) as total
         FROM purchase_invoices
         WHERE status = 'Approved' AND invoice_date BETWEEN ? AND ?${purchaseExtra}
         GROUP BY period ORDER BY period ASC`
    ).all(...purchaseParams);

    // Merge both series on the period key so the chart has one row per period.
    const merged = new Map();
    for (const r of perPeriodPurchased) merged.set(r.period, { period: r.period, purchased: Number(r.total), paid: 0 });
    for (const r of perPeriodPaid) {
        const row = merged.get(r.period) || { period: r.period, purchased: 0, paid: 0 };
        row.paid = r.total;
        merged.set(r.period, row);
    }
    const cashFlowPerPeriod = [...merged.values()].sort((a, b) => (a.period < b.period ? -1 : 1));

    const purchased = purchasedTotal(startDate, endDate, supplierId);
    const prevPurchased = purchasedTotal(prevStartDate, prevEndDate, supplierId);

    return {
        range: { startDate, endDate },
        granularity,
        kpis: {
            totalPaid: withComparison(cur.total, prev.total),
            paymentCount: withComparison(cur.count, prev.count),
            averagePayment: withComparison(cur.average, prev.average),
            largestPayment: withComparison(cur.largest, prev.largest)
        },
        perPeriod: perPeriodPaid,
        cashFlow: {
            purchased: withComparison(purchased, prevPurchased),
            paid: withComparison(cur.total, prev.total),
            netDebtChange: purchased - cur.total,
            paidRatio: purchased > 0 ? Math.round((cur.total / purchased) * 1000) / 10 : null,
            perPeriod: cashFlowPerPeriod
        }
    };
}

module.exports = { getPayments, getAnalytics };
