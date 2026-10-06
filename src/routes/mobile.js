// routes/mobile.js — owner-only controls for the mobile gateway.
// Loopback-only on purpose: these routes live on the main app, which the
// gateway also wraps, so they must refuse any non-local caller on their own
// (defence in depth on top of the gateway's endpoint allow-list).
const express = require('express');
const router = express.Router();
const mobileGateway = require('../services/mobileGatewayService');

router.use((req, res, next) => {
    if (!mobileGateway.isLoopback(req.socket.remoteAddress)) {
        return res.status(403).json({ error: 'متاح فقط من الجهاز نفسه' });
    }
    next();
});

router.get('/status', (req, res) => {
    try {
        res.json(mobileGateway.getStatus());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/enable', async (req, res) => {
    try {
        res.json(await mobileGateway.enable());
    } catch (err) {
        res.status(500).json({ error: `تعذّر تشغيل الاتصال بالهاتف: ${err.message}` });
    }
});

router.post('/disable', async (req, res) => {
    try {
        res.json(await mobileGateway.disable());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/pairing-code', (req, res) => {
    try {
        res.json(mobileGateway.createPairingCode());
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/devices', (req, res) => {
    try {
        res.json(mobileGateway.listDevices());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/devices/:id', (req, res) => {
    try {
        const ok = mobileGateway.revokeDevice(parseInt(req.params.id));
        if (!ok) return res.status(404).json({ error: 'الجهاز غير موجود' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
