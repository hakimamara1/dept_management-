// routes/invoices.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const invoiceProcessor = require('../services/invoiceProcessor');
const aiExtractionService = require('../services/aiExtractionService');
const db = require('../config/database');

// ── Shared upload config — the photo-attachment routes below and the AI
// extraction route further down both write into the same uploads dir.
// filename() can't always rely on req.params.id (the extract route creates
// the invoice *after* the upload, so there's no id yet at upload time) —
// falls back to 'new' in that case; the disk filename is just a label, the
// real invoice_id link lives in the invoice_attachments row.
const uploadsDir = path.join(__dirname, '../data/uploads/invoice-attachments');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.؀-ۿ_-]/g, '_');
        cb(null, `${req.params.id || 'new'}-${Date.now()}-${safeName}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/invoices/manual — for a supplier's handwritten invoice, where
// there's no OCR JSON to paste. See invoiceProcessor.createManualInvoice.
router.post('/manual', (req, res) => {
    try {
        const result = invoiceProcessor.createManualInvoice(req.body);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST /api/invoices/extract — upload a photo of the invoice, an AI model
// (Replicate/Gemini) extracts the data, then it's handed to the exact same
// processOcrResult() the JSON-paste route uses — lands at Pending Review
// like any other import. The uploaded photo is kept as an attachment.
router.post('/extract', upload.single('invoice'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'صورة الفاتورة مطلوبة' });
        }

        // ── DEBUG Step 1: what multer actually received ──
        console.log('[extract][1] multer file:', {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: req.file.path
        });

        const buffer = fs.readFileSync(req.file.path);

        // ── DEBUG Step 2: is the saved file itself valid? ──
        console.log('[extract][2] buffer length:', buffer.length,
            '| first bytes (hex):', buffer.subarray(0, 16).toString('hex'));
        const debugCopyPath = path.join(uploadsDir, 'debug-upload.jpg');
        fs.writeFileSync(debugCopyPath, buffer);
        console.log('[extract][2] debug copy saved to:', debugCopyPath);

        const ocrJson = await aiExtractionService.extractInvoiceData(buffer, req.file.mimetype);
        const result = invoiceProcessor.processOcrResult(ocrJson);

        db.stmts.insertInvoiceAttachment.run(
            result.invoiceId,
            `invoice-attachments/${req.file.filename}`,
            req.file.originalname
        );

        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST /api/invoices/:id/attachments — attach one or more photos.
router.post('/:id/attachments', upload.array('photos', 10), (req, res) => {
    try {
        const invoiceId = parseInt(req.params.id);
        const invoice = db.prepare('SELECT id FROM purchase_invoices WHERE id = ?').get(invoiceId);
        if (!invoice) {
            return res.status(404).json({ error: 'الفاتورة غير موجودة' });
        }
        for (const file of req.files || []) {
            db.stmts.insertInvoiceAttachment.run(
                invoiceId,
                `invoice-attachments/${file.filename}`,
                file.originalname
            );
        }
        res.json(db.stmts.getInvoiceAttachments.all(invoiceId));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/invoices/:id/attachments/:attachmentId — no status restriction,
// attachments are reference photos only, zero business-logic impact.
router.delete('/:id/attachments/:attachmentId', (req, res) => {
    try {
        const invoiceId = parseInt(req.params.id);
        const attachmentId = parseInt(req.params.attachmentId);
        const attachment = db.stmts.getInvoiceAttachmentById.get(attachmentId);
        if (!attachment || attachment.invoice_id !== invoiceId) {
            return res.status(404).json({ error: 'الصورة غير موجودة' });
        }

        try {
            fs.unlinkSync(path.join(__dirname, '../data/uploads', attachment.file_path));
        } catch {
            // The DB row is the source of truth — a file already missing on
            // disk shouldn't block removing the record.
        }

        db.stmts.deleteInvoiceAttachment.run(attachmentId);
        res.json(db.stmts.getInvoiceAttachments.all(invoiceId));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

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
        const attachments = db.stmts.getInvoiceAttachments.all(req.params.id);

        res.json({ invoice, items, attachments });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;