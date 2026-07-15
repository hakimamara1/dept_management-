// routes/accounting.js
const express = require('express');
const router = express.Router();
const { AccountingService } = require('../services/accountingService');

// GET /api/accounting/trial-balance
router.get('/trial-balance', (req, res) => {
    try {
        const tb = AccountingService.getTrialBalance();
        res.json(tb);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/accounting/balance-sheet
router.get('/balance-sheet', (req, res) => {
    try {
        const bs = AccountingService.getBalanceSheet();
        res.json(bs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/accounting/profit-loss
router.get('/profit-loss', (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const pl = AccountingService.getProfitLoss(startDate || null, endDate || null);
        res.json(pl);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/accounting/ledger/:accountCode
router.get('/ledger/:accountCode', (req, res) => {
    try {
        const { accountCode } = req.params;
        const ledger = AccountingService.getAccountLedger(accountCode);
        res.json(ledger);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/accounting/verify
router.get('/verify', (req, res) => {
    try {
        const verification = AccountingService.verifyBalance();
        res.json(verification);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/accounting/journal/:invoiceId
router.get('/journal/:invoiceId', (req, res) => {
    try {
        const invoiceId = parseInt(req.params.invoiceId);
        const entries = AccountingService.getJournalEntry(invoiceId);
        res.json(entries);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
