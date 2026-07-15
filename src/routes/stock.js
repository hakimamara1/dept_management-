// routes/stock.js
const express = require('express');
const router = express.Router();
const stockService = require('../services/stockService');

// GET /api/stock/summary
router.get('/summary', (req, res) => {
    try {
        const summary = stockService.getStockSummary();
        const totalValue = stockService.getTotalStockValue();
        res.json({ summary, totalValue });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stock/movements
router.get('/movements', (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'تاريخ البدء والنهاية مطلوبين (startDate & endDate)' });
        }
        const movements = stockService.getMovementsByDateRange(startDate, endDate);
        res.json(movements);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stock/movements/:productId
router.get('/movements/:productId', (req, res) => {
    try {
        const productId = parseInt(req.params.productId);
        const history = stockService.getMovementHistory(productId);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stock/low
router.get('/low', (req, res) => {
    try {
        const threshold = parseInt(req.query.threshold) || 10;
        const lowStock = stockService.getLowStockProducts(threshold);
        res.json(lowStock);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/stock/adjust
router.post('/adjust', (req, res) => {
    try {
        const { productId, actualQuantity, reason } = req.body;

        if (productId === undefined || actualQuantity === undefined) {
            return res.status(400).json({ error: 'المنتج والكمية الفعلية مطلوبين' });
        }

        const result = stockService.adjustStock(
            parseInt(productId),
            parseFloat(actualQuantity),
            reason || ''
        );
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
