// routes/purchaseOrders.js
const express = require('express');
const router = express.Router();
const purchaseOrderService = require('../services/purchaseOrderService');

// GET /api/purchase-orders
router.get('/', (req, res) => {
    try {
        const orders = purchaseOrderService.getAll();
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/purchase-orders/:id
router.get('/:id', (req, res) => {
    try {
        const order = purchaseOrderService.getById(parseInt(req.params.id));
        if (!order) {
            return res.status(404).json({ error: 'أمر الشراء غير موجود' });
        }
        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/purchase-orders
router.post('/', (req, res) => {
    try {
        const { supplierId, orderDate, expectedDate, notes, items } = req.body;

        if (!supplierId || !orderDate) {
            return res.status(400).json({ error: 'المورد وتاريخ الطلب مطلوبان' });
        }

        const order = purchaseOrderService.create({ supplierId, orderDate, expectedDate, notes, items });
        res.json(order);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PATCH /api/purchase-orders/:id/status
router.patch('/:id/status', (req, res) => {
    try {
        const { status } = req.body;
        const order = purchaseOrderService.updateStatus(parseInt(req.params.id), status);
        res.json(order);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
