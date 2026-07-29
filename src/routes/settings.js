// routes/settings.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const settingsService = require('../services/settingsService');
const { UPLOADS_DIR } = require('../config/paths');

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
const logoDir = path.join(UPLOADS_DIR, 'business-profile');
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
const restoreTmpDir = path.join(UPLOADS_DIR, 'tmp-restore');
fs.mkdirSync(restoreTmpDir, { recursive: true });
const restoreUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, restoreTmpDir),
        filename: (req, file, cb) => cb(null, `restore-${Date.now()}.db`)
    }),
    limits: { fileSize: 500 * 1024 * 1024 }
});

// GET /api/settings/backup
router.get('/backup', async (req, res) => {
    try {
        const backupPath = await settingsService.createBackup();
        const dateStamp = new Date().toISOString().slice(0, 10);
        res.download(backupPath, `spice-erp-backup-${dateStamp}.db`, (err) => {
            // res.download's callback fires after the response finishes (or
            // fails) either way — always clean up the temp file, and only
            // log the download error since headers may already be sent.
            fs.unlink(backupPath, () => {});
            if (err) console.error('[settings] backup download error:', err.message);
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/settings/restore — requires an app restart afterward, see business-rules.md.
router.post('/restore', restoreUpload.single('backup'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'ملف النسخة الاحتياطية مطلوب' });
        }
        const result = await settingsService.restoreBackup(req.file.path);
        res.json(result);
        // restoreBackup() already closed the live db connection and swapped
        // the file out from under it — nothing left in this process can
        // serve another database request correctly. Exit deliberately so
        // Electron's health check fails fast and the user is forced through
        // the restart the response just told them to do, instead of the
        // backend limping along until they get around to it.
        setImmediate(() => process.exit(0));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
