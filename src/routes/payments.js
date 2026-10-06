// routes/payments.js
const express = require('express');
const router = express.Router();
const paymentAnalyticsService = require('../services/paymentAnalyticsService');

// Shared by both routes: ?range=today|week|month|last_month|3months|year|custom&from=&to=&supplierId=
function filters(req) {
    const supplierId = parseInt(req.query.supplierId);
    return [req.query.range || null, req.query.from, req.query.to, Number.isNaN(supplierId) ? null : supplierId];
}

// GET /api/payments — every payment recorded against any supplier, newest
// first. Optional range/supplierId filters; with none, returns everything.
router.get('/', (req, res) => {
    try {
        res.json(paymentAnalyticsService.getPayments(...filters(req)));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/payments/analytics — KPIs with period comparison, payments over
// time, and paid-vs-purchased cash flow. range defaults to the current month.
router.get('/analytics', (req, res) => {
    try {
        const [range, from, to, supplierId] = filters(req);
        res.json(paymentAnalyticsService.getAnalytics(range || 'month', from, to, supplierId));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
