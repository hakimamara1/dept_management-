// routes/debtAnalysis.js
const express = require('express');
const router = express.Router();
const debtAnalysisService = require('../services/debtAnalysisService');

// GET /api/reports/debt-analysis?scope=suppliers|customers&range=...&from=&to=&entityId=
router.get('/debt-analysis', (req, res) => {
    try {
        const { scope = 'suppliers', range = 'month', from, to } = req.query;
        if (range === 'custom' && (!from || !to)) {
            return res.status(400).json({ error: 'حدد تاريخ البداية والنهاية للنطاق المخصص' });
        }
        const id = parseInt(req.query.entityId);
        const result = debtAnalysisService.getAnalysis({
            scope, range, from, to, entityId: Number.isNaN(id) ? null : id
        });
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
