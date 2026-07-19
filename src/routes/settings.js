// routes/settings.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const settingsService = require('../services/settingsService');

// GET /api/settings/business-profile
router.get('/business-profile', (req, res) => {
    try {
        res.json(settingsService.getBusinessProfile());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/settings/business-profile
router.patch('/business-profile', (req, res) => {
    try {
        res.json(settingsService.updateBusinessProfile(req.body));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ── Logo upload ──
const logoDir = path.join(__dirname, '../data/uploads/business-profile');
fs.mkdirSync(logoDir, { recursive: true });
const logoUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, logoDir),
        filename: (req, file, cb) => {
            const safeName = file.originalname.replace(/[^a-zA-Z0-9.؀-ۿ_-]/g, '_');
            cb(null, `logo-${Date.now()}-${safeName}`);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 }
});

// POST /api/settings/business-profile/logo
router.post('/business-profile/logo', logoUpload.single('logo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'الشعار مطلوب' });
        }
        const profile = settingsService.updateLogo(`business-profile/${req.file.filename}`);
        res.json(profile);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ── Backup / restore ──
const restoreTmpDir = path.join(__dirname, '../data/uploads/tmp-restore');
fs.mkdirSync(restoreTmpDir, { recursive: true });
const restoreUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, restoreTmpDir),
        filename: (req, file, cb) => cb(null, `restore-${Date.now()}.db`)
    }),
    limits: { fileSize: 500 * 1024 * 1024 }
});

// GET /api/settings/backup
router.get('/backup', (req, res) => {
    try {
        const dbPath = settingsService.createBackup();
        const dateStamp = new Date().toISOString().slice(0, 10);
        res.download(dbPath, `spice-erp-backup-${dateStamp}.db`);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/settings/restore — requires an app restart afterward, see business-rules.md.
router.post('/restore', restoreUpload.single('backup'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'ملف النسخة الاحتياطية مطلوب' });
        }
        const result = settingsService.restoreBackup(req.file.path);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
