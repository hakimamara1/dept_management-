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

// POST /api/invoices/:id/approve — the one posting step. Requires every
// item to already carry a real product_id; no decisions body anymore,
// matching now happens beforehand via the item-editing routes below.
router.post('/:id/approve', (req, res) => {
    try {
        const result = invoiceProcessor.approveInvoice(parseInt(req.params.id));
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PATCH /api/invoices/:id/items/:itemId — correct name/quantity/unit/price
// and/or resolve the product match. Pending Review only.
router.patch('/:id/items/:itemId', (req, res) => {
    try {
        const invoiceId = parseInt(req.params.id);
        const itemId = parseInt(req.params.itemId);
        const item = invoiceProcessor.updateInvoiceItem(invoiceId, itemId, req.body);
        res.json(item);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST /api/invoices/:id/items — add a missing line. Pending Review only.
router.post('/:id/items', (req, res) => {
    try {
        const invoiceId = parseInt(req.params.id);
        const item = invoiceProcessor.addInvoiceItem(invoiceId, req.body);
        res.json(item);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/invoices/:id/items/:itemId — remove an incorrect line.
// Pending Review only; rejects deleting the last remaining item.
router.delete('/:id/items/:itemId', (req, res) => {
    try {
        const invoiceId = parseInt(req.params.id);
        const itemId = parseInt(req.params.itemId);
        const result = invoiceProcessor.deleteInvoiceItem(invoiceId, itemId);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PATCH /api/invoices/:id/notes — the one field still editable after
// approval (see business-rules.md).
router.patch('/:id/notes', (req, res) => {
    try {
        const invoiceId = parseInt(req.params.id);
        const result = invoiceProcessor.updateInvoiceNotes(invoiceId, req.body.notes);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
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