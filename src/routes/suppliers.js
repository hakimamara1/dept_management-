// routes/suppliers.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const debtService = require('../services/debtService');
const { AccountingService } = require('../services/accountingService');

// GET /api/suppliers
router.get('/', (req, res) => {
    try {
        const query = req.query.query;
        let suppliers;
        if (query) {
            suppliers = db.stmts.suppliers.search.all(`%${query}%`);
        } else {
            suppliers = db.stmts.suppliers.getAll.all();
        }
        res.json(suppliers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/suppliers/aging
router.get('/aging', (req, res) => {
    try {
        const agingReport = debtService.getAgingReport();
        res.json(agingReport);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/suppliers/:id
router.get('/:id', (req, res) => {
    try {
        const supplier = db.stmts.suppliers.getById.get(parseInt(req.params.id));
        if (!supplier) {
            return res.status(404).json({ error: 'المورد غير موجود' });
        }
        res.json(supplier);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/suppliers/:id/ledger
router.get('/:id/ledger', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const ledger = debtService.getSupplierLedger(id);
        res.json(ledger);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/suppliers/:id/statement
router.get('/:id/statement', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { startDate, endDate } = req.query;
        const statement = debtService.getStatement(id, startDate || null, endDate || null);
        res.json(statement);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/suppliers/:id/payments
router.post('/:id/payments', (req, res) => {
    try {
        const supplierId = parseInt(req.params.id);
        const { amount, paymentMethod, reference, notes, date } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'مبلغ الدفع يجب أن يكون أكبر من الصفر' });
        }

        const result = db.transaction(() => {
            // 1. Record payment in Supplier Debt Ledger
            const debtResult = debtService.recordPayment(supplierId, amount, paymentMethod || 'cash', reference || '', notes || '');
            
            // 2. Record double-entry transaction in General Ledger
            const formattedDate = date || new Date().toISOString().split('T')[0];
            const supplier = db.stmts.suppliers.getById.get(supplierId);
            const supplierName = supplier ? supplier.name : `Supplier #${supplierId}`;
            const description = `دفع للمورد: ${supplierName} عبر ${paymentMethod || 'cash'}. ${notes || ''}`.trim();
            
            const accountingResult = AccountingService.recordPayment(
                null,
                formattedDate,
                amount,
                paymentMethod || 'cash',
                description
            );

            return { debt: debtResult, accounting: accountingResult };
        })();

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/suppliers/:id/adjust
router.post('/:id/adjust', (req, res) => {
    try {
        const supplierId = parseInt(req.params.id);
        const { amount, reason } = req.body;

        if (amount === undefined || amount === 0) {
            return res.status(400).json({ error: 'قيمة التسوية لا يمكن أن تكون صفراً' });
        }

        const result = debtService.adjustBalance(supplierId, amount, reason || 'تسوية رصيد يدوية');
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
