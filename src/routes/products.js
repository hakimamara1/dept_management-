// routes/products.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const productService = require('../services/productService');
const { normalizeArabic } = require('../utils/arabicNormalizer');

// GET /api/products?query=&sort=name|newest — full browsable list (no LIMIT),
// unlike /search below which stays capped/fast for picker use. `sort`
// is whitelisted (never interpolated from the request) since ORDER BY
// can't be parameterized as a bound value.
router.get('/', (req, res) => {
    try {
        const { query, sort } = req.query;
        const orderBy = sort === 'newest' ? 'p.created_at DESC' : 'p.name ASC';

        const params = [];
        let where = '';
        if (query) {
            const normalized = normalizeArabic(query);
            where = 'WHERE p.name LIKE ? OR pa.normalized_alias LIKE ?';
            params.push(`%${query}%`, `%${normalized}%`);
        }

        const products = db.prepare(
            `SELECT DISTINCT p.*
             FROM products p
             LEFT JOIN product_aliases pa ON p.id = pa.product_id
             ${where}
             ORDER BY ${orderBy}`
        ).all(...params);

        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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
        const { name, barcode, category, unit, defaultSalePrice } = req.body;
        const result = db.stmts.products.insert.run(
            name, barcode || null, category || null, unit || null, defaultSalePrice ?? null
        );

        res.json({ id: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/products/:id — catalog fields only (name/barcode/category/unit).
// Cost fields (last_purchase_price/average_cost) stay system-computed and
// are never accepted here; the sale price has its own endpoint below.
router.patch('/:id', (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const product = db.stmts.getProductById.get(productId);
        if (!product) {
            return res.status(404).json({ error: 'المنتج غير موجود' });
        }

        const { name, barcode, category, unit } = req.body;
        db.stmts.products.update.run(
            name ?? product.name,
            barcode !== undefined ? barcode : product.barcode,
            category !== undefined ? category : product.category,
            unit ?? product.unit,
            productId
        );

        res.json(db.stmts.getProductById.get(productId));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PATCH /api/products/:id/price — sets the suggested selling price
// (default_sale_price). Separate from PATCH /:id since this is the one
// product field a user sets directly rather than it being derived from
// invoice history.
router.patch('/:id/price', (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const product = db.stmts.getProductById.get(productId);
        if (!product) {
            return res.status(404).json({ error: 'المنتج غير موجود' });
        }

        const { defaultSalePrice } = req.body;
        if (defaultSalePrice == null || Number(defaultSalePrice) < 0) {
            return res.status(400).json({ error: 'السعر مطلوب ويجب أن يكون صفراً أو أكبر' });
        }

        db.stmts.products.updateSalePrice.run(Number(defaultSalePrice), productId);
        res.json(db.stmts.getProductById.get(productId));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST /api/products/merge — merges `mergeId` into `keepId` (accidental
// duplicate cleanup). See productService.mergeProducts for what moves over.
router.post('/merge', (req, res) => {
    try {
        const { keepId, mergeId } = req.body;
        if (!keepId || !mergeId) {
            return res.status(400).json({ error: 'يجب تحديد المنتج المُبقى والمنتج المدمج' });
        }
        const result = productService.mergeProducts(Number(keepId), Number(mergeId));
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;