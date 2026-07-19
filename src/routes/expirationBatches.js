// routes/expirationBatches.js
const express = require('express');
const router = express.Router();
const expirationService = require('../services/expirationService');

// GET /api/expiration-batches — query params: productId?, category?, status?,
// expiringWithinDays?, search?
router.get('/', (req, res) => {
    try {
        const { productId, category, status, expiringWithinDays, search } = req.query;
        const batches = expirationService.getAll({
            productId: productId ? parseInt(productId) : undefined,
            category: category || undefined,
            status: status || undefined,
            expiringWithinDays: expiringWithinDays ? parseInt(expiringWithinDays) : undefined,
            search: search || undefined
        });
        res.json(batches);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/expiration-batches/dashboard-summary — registered before /:id
router.get('/dashboard-summary', (req, res) => {
    try {
        res.json(expirationService.getDashboardSummary());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/expiration-batches/reports/expiring?days=7
router.get('/reports/expiring', (req, res) => {
    try {
        const days = req.query.days ? parseInt(req.query.days) : 30;
        res.json(expirationService.getExpiringReport(days));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/expiration-batches/reports/expired
router.get('/reports/expired', (req, res) => {
    try {
        res.json(expirationService.getExpiredReport());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/expiration-batches/reports/discarded
router.get('/reports/discarded', (req, res) => {
    try {
        res.json(expirationService.getDiscardedReport());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/expiration-batches/:id
router.get('/:id', (req, res) => {
    try {
        const batch = expirationService.getById(parseInt(req.params.id));
        if (!batch) {
            return res.status(404).json({ error: 'الدفعة غير موجودة' });
        }
        res.json(batch);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/expiration-batches
router.post('/', (req, res) => {
    try {
        const batch = expirationService.createBatch(req.body);
        res.json(batch);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PATCH /api/expiration-batches/:id — product cannot be changed after creation.
router.patch('/:id', (req, res) => {
    try {
        const batch = expirationService.updateBatch(parseInt(req.params.id), req.body);
        res.json(batch);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PATCH /api/expiration-batches/:id/status — body: { status }, only
// 'DISCARDED'/'SOLD'/'ACTIVE' (the date-derived values are never user-settable).
router.patch('/:id/status', (req, res) => {
    try {
        const batch = expirationService.setBatchStatus(parseInt(req.params.id), req.body.status);
        res.json(batch);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/expiration-batches/:id
router.delete('/:id', (req, res) => {
    try {
        const result = expirationService.deleteBatch(parseInt(req.params.id));
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
