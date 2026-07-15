// routes/payments.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/payments — every payment recorded against any supplier, newest first
router.get('/', (req, res) => {
    try {
        const payments = db.stmts.debt.getAllPayments.all();
        res.json(payments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
