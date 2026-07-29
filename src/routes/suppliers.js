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

// POST /api/suppliers — add a supplier directly, without waiting for an
// invoice to create one via supplierMatcher.findOrCreateSupplier.
router.post('/', (req, res) => {
    try {
        const { name, phone, email, address, taxNumber, commercialRegister } = req.body;
        if (!name || !name.toString().trim()) {
            return res.status(400).json({ error: 'اسم المورد مطلوب' });
        }

        const existing = db.stmts.getSupplierByName.get(name.toString().trim());
        if (existing) {
            return res.status(400).json({ error: 'مورد بنفس الاسم موجود مسبقاً' });
        }

        const result = db.stmts.insertSupplier.run(
            name.toString().trim(),
            phone || null,
            email || null,
            address || null,
            taxNumber || null,
            commercialRegister || null
        );

        res.json(db.stmts.suppliers.getById.get(result.lastInsertRowid));
    } catch (err) {
        res.status(400).json({ error: err.message });
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

// DELETE /api/suppliers/:id — only for a supplier that was truly never
// used. A nonzero balance blocks it outright; a zero balance from full
// repayment does not, since purchase_invoices/supplier_transactions still
// have no ON DELETE clause on supplier_id (foreign_keys=ON in database.js)
// — deleting a supplier with real history would either throw a raw FK
// error or (if it didn't) destroy invoice/payment provenance.
router.delete('/:id', (req, res) => {
    try {
        const supplierId = parseInt(req.params.id);
        const supplier = db.stmts.suppliers.getById.get(supplierId);
        if (!supplier) {
            return res.status(404).json({ error: 'المورد غير موجود' });
        }

        if (Number(supplier.current_balance) !== 0) {
            return res.status(400).json({ error: 'لا يمكن حذف مورد رصيده ليس صفراً' });
        }

        const invoiceCount = db.prepare(
            'SELECT COUNT(*) as count FROM purchase_invoices WHERE supplier_id = ?'
        ).get(supplierId).count;
        const transactionCount = db.prepare(
            'SELECT COUNT(*) as count FROM supplier_transactions WHERE supplier_id = ?'
        ).get(supplierId).count;

        if (invoiceCount > 0 || transactionCount > 0) {
            return res.status(400).json({ error: 'لا يمكن حذف مورد لديه فواتير أو حركات مسجلة' });
        }

        db.prepare('DELETE FROM suppliers WHERE id = ?').run(supplierId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
