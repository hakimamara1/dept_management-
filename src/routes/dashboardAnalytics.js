// routes/dashboardAnalytics.js
const express = require('express');
const router = express.Router();
const dashboardAnalyticsService = require('../services/dashboardAnalyticsService');

function rangeParams(req) {
    return [req.query.range || 'month', req.query.from, req.query.to];
}

router.get('/kpis', (req, res) => {
    try {
        res.json(dashboardAnalyticsService.getKpis(...rangeParams(req)));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/debt-evolution', (req, res) => {
    try {
        res.json(dashboardAnalyticsService.getDebtEvolution(...rangeParams(req)));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/debt-by-supplier', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 8;
        res.json(dashboardAnalyticsService.getDebtBySupplier(limit));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/purchases', (req, res) => {
    try {
        res.json(dashboardAnalyticsService.getPurchaseAnalytics(...rangeParams(req)));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/price-changes', (req, res) => {
    try {
        res.json(dashboardAnalyticsService.getPriceChanges(...rangeParams(req)));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/outstanding-debts', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        res.json(dashboardAnalyticsService.getOutstandingDebts(limit));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/activity', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        res.json(dashboardAnalyticsService.getRecentActivity(limit));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
