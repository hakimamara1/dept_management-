// routes/invoices.js
const express = require('express');
const router = express.Router();
const invoiceProcessor = require('../services/invoiceProcessor');
const db = require('../config/database');

// POST /api/invoices/ocr
router.post('/ocr', (req, res) => {
    try {
        const ocrJson = req.body;
        const result = invoiceProcessor.processOcrResult(ocrJson);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/invoices/:id/approve
router.post('/:id/approve', (req, res) => {
    try {
        const { decisions } = req.body;
        const result = invoiceProcessor.approveInvoice(parseInt(req.params.id), decisions);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/invoices/approved
router.get('/approved', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const QUERIES = require('../models/queries');
        const invoices = db.prepare(QUERIES.invoices.getApproved).all(limit, offset);
        res.json(invoices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/invoices/pending
router.get('/pending', (req, res) => {
    try {
        const invoices = db.stmts.getPendingInvoices.all();
        res.json(invoices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/invoices/:id/review
router.get('/:id/review', (req, res) => {
    try {
        const invoice = db.prepare(
            `SELECT pi.*, s.name as supplier_name, s.current_balance
             FROM purchase_invoices pi
             JOIN suppliers s ON pi.supplier_id = s.id
             WHERE pi.id = ?`
        ).get(req.params.id);

        const items = db.stmts.getReviewData.all(req.params.id);

        res.json({ invoice, items });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;