// routes/customers.js
const express = require('express');
const router = express.Router();
const customerService = require('../services/customerService');

// GET /api/customers
router.get('/', (req, res) => {
    try {
        const customers = customerService.getAll(req.query.query);
        res.json(customers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/customers
router.post('/', (req, res) => {
    try {
        const { fullName, phone, address, notes } = req.body;
        const customer = customerService.create({ fullName, phone, address, notes });
        res.json(customer);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET /api/customers/reports/summary — registered before /:id so "reports" is never read as a customer id
router.get('/reports/summary', (req, res) => {
    try {
        const summary = customerService.getReportsSummary();
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/customers/:id
router.get('/:id', (req, res) => {
    try {
        const customer = customerService.getById(parseInt(req.params.id));
        if (!customer) {
            return res.status(404).json({ error: 'العميل غير موجود' });
        }
        res.json(customer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/customers/:id/invoices
router.get('/:id/invoices', (req, res) => {
    try {
        const invoices = customerService.getInvoicesByCustomer(parseInt(req.params.id));
        res.json(invoices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/customers/:id/invoices
router.post('/:id/invoices', (req, res) => {
    try {
        const customerId = parseInt(req.params.id);
        const { invoiceDate, items, notes } = req.body;
        const invoice = customerService.createInvoice(customerId, { invoiceDate, items, notes });
        res.json(invoice);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET /api/customers/:id/invoices/:invoiceId
router.get('/:id/invoices/:invoiceId', (req, res) => {
    try {
        const customerId = parseInt(req.params.id);
        const invoiceId = parseInt(req.params.invoiceId);
        const invoice = customerService.getInvoice(customerId, invoiceId);
        if (!invoice) {
            return res.status(404).json({ error: 'الفاتورة غير موجودة' });
        }
        res.json(invoice);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/customers/:id/invoices/:invoiceId/items/:itemId — Draft only.
router.patch('/:id/invoices/:invoiceId/items/:itemId', (req, res) => {
    try {
        const customerId = parseInt(req.params.id);
        const invoiceId = parseInt(req.params.invoiceId);
        const itemId = parseInt(req.params.itemId);
        const invoice = customerService.updateInvoiceItem(customerId, invoiceId, itemId, req.body);
        res.json(invoice);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST /api/customers/:id/invoices/:invoiceId/items — Draft only.
router.post('/:id/invoices/:invoiceId/items', (req, res) => {
    try {
        const customerId = parseInt(req.params.id);
        const invoiceId = parseInt(req.params.invoiceId);
        const invoice = customerService.addInvoiceItem(customerId, invoiceId, req.body);
        res.json(invoice);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/customers/:id/invoices/:invoiceId/items/:itemId — Draft only,
// rejects deleting the last remaining item.
router.delete('/:id/invoices/:invoiceId/items/:itemId', (req, res) => {
    try {
        const customerId = parseInt(req.params.id);
        const invoiceId = parseInt(req.params.invoiceId);
        const itemId = parseInt(req.params.itemId);
        const invoice = customerService.deleteInvoiceItem(customerId, invoiceId, itemId);
        res.json(invoice);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PATCH /api/customers/:id/invoices/:invoiceId/notes — Draft only.
router.patch('/:id/invoices/:invoiceId/notes', (req, res) => {
    try {
        const customerId = parseInt(req.params.id);
        const invoiceId = parseInt(req.params.invoiceId);
        const invoice = customerService.updateInvoiceNotes(customerId, invoiceId, req.body.notes);
        res.json(invoice);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/customers/:id/invoices/:invoiceId — deletes the whole draft
// (header + items). Draft only — see customerService.deleteInvoice.
router.delete('/:id/invoices/:invoiceId', (req, res) => {
    try {
        const customerId = parseInt(req.params.id);
        const invoiceId = parseInt(req.params.invoiceId);
        const result = customerService.deleteInvoice(customerId, invoiceId);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST /api/customers/:id/invoices/:invoiceId/approve — locks the draft in,
// affecting the customer's balance/statement for the first time.
router.post('/:id/invoices/:invoiceId/approve', (req, res) => {
    try {
        const customerId = parseInt(req.params.id);
        const invoiceId = parseInt(req.params.invoiceId);
        const invoice = customerService.approveInvoice(customerId, invoiceId);
        res.json(invoice);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET /api/customers/:id/payments
router.get('/:id/payments', (req, res) => {
    try {
        const payments = customerService.getPaymentsByCustomer(parseInt(req.params.id));
        res.json(payments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/customers/:id/payments
router.post('/:id/payments', (req, res) => {
    try {
        const customerId = parseInt(req.params.id);
        const { paymentDate, amount, paymentMethod, notes } = req.body;
        const payment = customerService.recordPayment(customerId, { paymentDate, amount, paymentMethod, notes });
        res.json(payment);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST /api/customers/:id/adjust — manual balance correction, mirrors
// POST /api/suppliers/:id/adjust.
router.post('/:id/adjust', (req, res) => {
    try {
        const customerId = parseInt(req.params.id);
        const { amount, reason } = req.body;
        const result = customerService.adjustBalance(customerId, amount, reason);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET /api/customers/:id/statement
router.get('/:id/statement', (req, res) => {
    try {
        const statement = customerService.getStatement(parseInt(req.params.id));
        res.json(statement);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
