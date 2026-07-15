// routes/products.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { normalizeArabic } = require('../utils/arabicNormalizer');

// GET /api/products/search?query=زيت الكابتن
router.get('/search', (req, res) => {
    try {
        const { query } = req.query;
        const normalized = normalizeArabic(query);

        const products = db.prepare(
            `SELECT p.*, pa.alias 
             FROM products p
             LEFT JOIN product_aliases pa ON p.id = pa.product_id
             WHERE p.name LIKE ? OR pa.normalized_alias LIKE ?
             LIMIT 10`
        ).all(`%${query}%`, `%${normalized}%`);

        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/products/:id/price-history
router.get('/:id/price-history', (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const product = db.stmts.getProductById.get(productId);
        if (!product) {
            return res.status(404).json({ error: 'المنتج غير موجود' });
        }

        const rows = db.stmts.products.getPriceHistory.all(productId);
        const points = rows.map(r => ({
            date: r.invoice_date,
            price: Number(r.unit_price),
            quantity: Number(r.quantity),
            supplier: r.supplier_name,
            invoiceNumber: r.invoice_number
        }));

        let stats = null;
        if (points.length) {
            const prices = points.map(p => p.price);
            const first = points[0].price;
            const last = points[points.length - 1].price;
            stats = {
                count: points.length,
                min: Math.min(...prices),
                max: Math.max(...prices),
                avg: prices.reduce((a, b) => a + b, 0) / prices.length,
                first,
                last,
                changeAbs: last - first,
                changePct: first ? ((last - first) / first) * 100 : 0,
                trend: points.length < 2 ? 'flat' : (last > first ? 'up' : (last < first ? 'down' : 'flat'))
            };
        }

        res.json({
            product: { id: product.id, name: product.name, unit: product.unit },
            points,
            stats
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/products
router.post('/', (req, res) => {
    try {
        const { name, barcode, category, unit } = req.body;
        const result = db.prepare(
            'INSERT INTO products (name, barcode, category, unit) VALUES (?, ?, ?, ?)'
        ).run(name, barcode, category, unit);

        res.json({ id: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;