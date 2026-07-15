// routes/analytics.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/analytics/dashboard
router.get('/dashboard', (req, res) => {
    try {
        const stats = db.stmts.analytics.getDashboardStats.get();
        
        // Let's also include the total stock value in the dashboard statistics
        const stockValueResult = db.stmts.stock.getStockValueTotal.get();
        stats.total_stock_value = Number(stockValueResult.total_value || 0);

        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
