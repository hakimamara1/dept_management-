// services/mobileGatewayService.js
//
// Lets the Android companion app reach this backend over the local network
// WITHOUT weakening the desktop's own surface: the main Express app keeps
// listening on 127.0.0.1 with no auth (exactly as before), and this service
// adds a SECOND listener on 0.0.0.0 that wraps that same app behind:
//
//   private-network-only → pairing (public) → bearer-token guard →
//   handshake → endpoint allow-list → OCR rate limit → idempotency → main app
//
// Off by default; the owner enables it in Settings. Tokens are random 256-bit
// values of which only a SHA-256 hash is stored.
const express = require('express');
const http = require('http');
const os = require('os');
const crypto = require('crypto');
const db = require('../config/database');

const API_VERSION = 1;
const DEFAULT_PORT = 3001;
const PORT_TRIES = 10;
const PAIR_TTL_MS = 5 * 60 * 1000;
const MAX_PAIR_ATTEMPTS = 5;
const PAIR_RATE = { windowMs: 60 * 1000, max: 10 };
const OCR_RATE = { windowMs: 10 * 60 * 1000, max: 10 };
const TOUCH_THROTTLE_MS = 30 * 1000;
// No look-alike characters (0/O, 1/I/L) in case a code is ever typed by hand.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 20;

// Least privilege: the phone only gets the modules it has screens for.
// Everything else — notably /api/settings (restore/backup replace or export the
// whole database), /api/accounting and /api/mobile admin — is unreachable.
const ALLOWED_PREFIXES = /^\/(api\/(invoices|products|suppliers|customers|payments|dashboard|reports)|uploads)(\/|$)/;

let mainApp = null;
let gateway = null;      // { server, port, bonjour }
let pairing = null;      // { code, expiresAt, attempts }
const pairHits = new Map();
const ocrHits = new Map();
const lastTouch = new Map();
const inFlight = new Set();
let pruneTimer = null;

function appVersion() {
    for (const rel of ['../../package.json', '../package.json']) {
        try { return require(rel).version || '0.0.0'; } catch { /* try next layout (dev vs packaged) */ }
    }
    return '0.0.0';
}

// ── helpers ──────────────────────────────────────────────────────────────

function isPrivateAddress(raw) {
    const addr = String(raw || '').replace(/^::ffff:/i, '').toLowerCase();
    const v4 = addr.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (v4) {
        const [a, b] = [Number(v4[1]), Number(v4[2])];
        return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) || (a === 169 && b === 254);
    }
    return addr === '::1' || addr.startsWith('fe80:') || /^f[cd][0-9a-f]{2}:/.test(addr);
}

function isLoopback(raw) {
    const addr = String(raw || '').replace(/^::ffff:/i, '');
    return addr === '127.0.0.1' || addr === '::1';
}

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function safeEqual(a, b) {
    const x = Buffer.from(String(a));
    const y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function rateLimited(map, key, { windowMs, max }) {
    const now = Date.now();
    const hits = (map.get(key) || []).filter((t) => now - t < windowMs);
    if (hits.length >= max) {
        map.set(key, hits);
        return true;
    }
    hits.push(now);
    map.set(key, hits);
    return false;
}

function desktopName() {
    const row = db.prepare('SELECT business_name FROM business_profile WHERE id = 1').get();
    return (row && row.business_name && row.business_name.trim()) || os.hostname();
}

function getLanHosts() {
    const hosts = [];
    for (const [name, list] of Object.entries(os.networkInterfaces())) {
        for (const i of list || []) {
            const isV4 = i.family === 'IPv4' || i.family === 4;
            if (isV4 && !i.internal && isPrivateAddress(i.address) && !i.address.startsWith('169.254.')) {
                hosts.push({ name, address: i.address });
            }
        }
    }
    return hosts;
}

const isEnabled = () => !!db.prepare('SELECT enabled FROM mobile_settings WHERE id = 1').get().enabled;
const setEnabled = (on) => db.prepare('UPDATE mobile_settings SET enabled = ? WHERE id = 1').run(on ? 1 : 0);

// ── middleware ───────────────────────────────────────────────────────────

function privateNetworkOnly(req, res, next) {
    if (!isPrivateAddress(req.socket.remoteAddress)) {
        return res.status(403).json({ error: 'الاتصال مسموح فقط من الشبكة المحلية' });
    }
    next();
}

function handlePair(req, res) {
    const ip = req.socket.remoteAddress;
    if (rateLimited(pairHits, ip, PAIR_RATE)) {
        return res.status(429).json({ error: 'محاولات كثيرة — انتظر دقيقة ثم أعد المحاولة' });
    }
    const { code, deviceName } = req.body || {};
    if (typeof code !== 'string' || typeof deviceName !== 'string' || !deviceName.trim()) {
        return res.status(400).json({ error: 'رمز الاقتران واسم الجهاز مطلوبان' });
    }
    if (!pairing || Date.now() > pairing.expiresAt) {
        pairing = null;
        return res.status(410).json({ error: 'انتهت صلاحية رمز الاقتران — أنشئ رمزاً جديداً من البرنامج' });
    }
    if (!safeEqual(code, pairing.code)) {
        pairing.attempts += 1;
        if (pairing.attempts >= MAX_PAIR_ATTEMPTS) pairing = null; // burn the code after too many guesses
        return res.status(401).json({ error: 'رمز الاقتران غير صحيح' });
    }

    pairing = null; // single use
    const token = crypto.randomBytes(32).toString('base64url');
    const name = deviceName.trim().slice(0, 60);
    const result = db.prepare('INSERT INTO mobile_devices (name, token_hash, last_ip, last_seen_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)')
        .run(name, hashToken(token), ip);
    res.json({ token, deviceId: Number(result.lastInsertRowid), desktopName: desktopName(), apiVersion: API_VERSION });
}

function authGuard(req, res, next) {
    const m = /^Bearer (.+)$/.exec(req.get('authorization') || '');
    if (!m) return res.status(401).json({ error: 'مطلوب تسجيل الدخول — اقرن الهاتف أولاً' });
    const device = db.prepare('SELECT id, name FROM mobile_devices WHERE token_hash = ? AND revoked_at IS NULL')
        .get(hashToken(m[1]));
    if (!device) return res.status(401).json({ error: 'الجهاز غير مصرّح — أعد الاقتران' });
    req.mobileDevice = device;

    // last_seen is informational: throttle so a busy phone doesn't write on every request.
    const now = Date.now();
    if (now - (lastTouch.get(device.id) || 0) > TOUCH_THROTTLE_MS) {
        lastTouch.set(device.id, now);
        db.prepare('UPDATE mobile_devices SET last_seen_at = CURRENT_TIMESTAMP, last_ip = ? WHERE id = ?')
            .run(req.socket.remoteAddress, device.id);
    }
    next();
}

function handleHandshake(req, res) {
    res.json({
        app: 'spice-erp', apiVersion: API_VERSION, appVersion: appVersion(),
        desktopName: desktopName(), deviceId: req.mobileDevice.id, deviceName: req.mobileDevice.name,
        serverTime: new Date().toISOString()
    });
}

function allowList(req, res, next) {
    // Strict, case-sensitive allow-list: Express matches routes case-insensitively,
    // so a deny-list could be dodged with /API/Settings/Restore.
    if (!ALLOWED_PREFIXES.test(req.path)) {
        return res.status(403).json({ error: 'هذا المسار غير متاح للهاتف' });
    }
    next();
}

// The photo → AI call costs money per request; stop a stuck retry loop on a phone.
function ocrRateLimit(req, res, next) {
    if (req.method === 'POST' && req.path === '/api/invoices/extract' &&
        rateLimited(ocrHits, req.mobileDevice.id, OCR_RATE)) {
        return res.status(429).json({ error: 'تم تجاوز حد مسح الفواتير — انتظر قليلاً' });
    }
    next();
}

// Replays the first response when a phone retries the same money request
// (timeout / dropped Wi-Fi) so a payment can never be recorded twice.
function idempotency(req, res, next) {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const key = req.get('idempotency-key');
    if (!key) return next();
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(key)) return res.status(400).json({ error: 'Idempotency-Key غير صالح' });

    const deviceId = req.mobileDevice.id;
    const path = req.originalUrl.split('?')[0];
    const row = db.prepare('SELECT method, path, status, response_json FROM idempotency_keys WHERE device_id = ? AND key = ?')
        .get(deviceId, key);
    if (row) {
        if (row.method !== req.method || row.path !== path) {
            return res.status(422).json({ error: 'Idempotency-Key مستخدم مع طلب مختلف' });
        }
        res.set('Idempotent-Replay', 'true');
        return res.status(row.status).type('json').send(row.response_json);
    }

    const flightId = `${deviceId}:${key}`;
    if (inFlight.has(flightId)) return res.status(409).json({ error: 'الطلب قيد التنفيذ بالفعل' });
    inFlight.add(flightId);
    res.on('close', () => inFlight.delete(flightId));

    const original = res.json.bind(res);
    res.json = (body) => {
        try {
            // Only successful results are remembered; a failed attempt may be retried for real.
            if (res.statusCode >= 200 && res.statusCode < 300) {
                db.prepare('INSERT OR REPLACE INTO idempotency_keys (device_id, key, method, path, status, response_json) VALUES (?, ?, ?, ?, ?, ?)')
                    .run(deviceId, key, req.method, path, res.statusCode, JSON.stringify(body));
            }
        } catch (err) {
            console.error('[mobile] idempotency store failed:', err.message);
        }
        return original(body);
    };
    next();
}

function buildGatewayApp() {
    const gw = express();
    gw.disable('x-powered-by');
    gw.use(privateNetworkOnly);
    gw.post('/api/mobile/pair', express.json({ limit: '10kb' }), handlePair);
    gw.use(authGuard);
    gw.get('/api/mobile/handshake', handleHandshake);
    gw.use(allowList);
    gw.use(ocrRateLimit);
    gw.use(idempotency);
    gw.use(mainApp);
    gw.use((req, res) => res.status(404).json({ error: 'غير موجود' }));
    return gw;
}

// ── lifecycle ────────────────────────────────────────────────────────────

function listenOnFreePort(server, port, triesLeft) {
    return new Promise((resolve, reject) => {
        const onError = (err) => {
            server.removeListener('listening', onListening);
            if (err.code === 'EADDRINUSE' && triesLeft > 0) {
                resolve(listenOnFreePort(server, port + 1, triesLeft - 1));
            } else {
                reject(err);
            }
        };
        const onListening = () => {
            server.removeListener('error', onError);
            resolve(port);
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, '0.0.0.0');
    });
}

function publishDiscovery(port) {
    try {
        const { Bonjour } = require('bonjour-service');
        const bonjour = new Bonjour();
        const service = bonjour.publish({
            name: `Spice ERP - ${os.hostname()}`.slice(0, 60),
            type: 'spiceerp',
            protocol: 'tcp',
            port,
            txt: { app: 'spice-erp', v: String(API_VERSION) }
        });
        service.on('error', (err) => console.error('[mobile] mDNS error:', err.message));
        return bonjour;
    } catch (err) {
        // Discovery is a convenience — pairing by QR still works without it.
        console.error('[mobile] mDNS unavailable:', err.message);
        return null;
    }
}

async function start() {
    if (gateway) return getStatus();
    const server = http.createServer(buildGatewayApp());
    const port = await listenOnFreePort(server, DEFAULT_PORT, PORT_TRIES);
    gateway = { server, port, bonjour: publishDiscovery(port) };

    db.prepare("DELETE FROM idempotency_keys WHERE created_at < datetime('now', '-1 day')").run();
    pruneTimer = setInterval(() => {
        try { db.prepare("DELETE FROM idempotency_keys WHERE created_at < datetime('now', '-1 day')").run(); } catch { /* db closing */ }
    }, 60 * 60 * 1000);
    pruneTimer.unref();

    console.log(`[mobile] gateway listening on 0.0.0.0:${port}`);
    return getStatus();
}

function stop() {
    pairing = null;
    if (pruneTimer) { clearInterval(pruneTimer); pruneTimer = null; }
    if (!gateway) return Promise.resolve();
    const { server, bonjour } = gateway;
    gateway = null;
    return new Promise((resolve) => {
        const finish = () => { try { bonjour && bonjour.destroy(); } catch { /* already gone */ } resolve(); };
        try { bonjour ? bonjour.unpublishAll(() => finish()) : finish(); } catch { finish(); }
        server.close();
        server.closeAllConnections();
    });
}

function init(app) {
    mainApp = app;
    if (isEnabled()) {
        start().catch((err) => console.error('[mobile] could not start gateway:', err.message));
    }
}

async function enable() {
    setEnabled(true);
    try {
        return await start();
    } catch (err) {
        setEnabled(false); // don't claim "enabled" if we couldn't actually listen
        throw err;
    }
}

async function disable() {
    setEnabled(false);
    await stop();
    return getStatus();
}

// ── admin API (used by routes/mobile.js, loopback-only) ──────────────────

function getStatus() {
    return {
        enabled: isEnabled(),
        running: !!gateway,
        port: gateway ? gateway.port : null,
        hosts: getLanHosts(),
        desktopName: desktopName(),
        discovery: !!(gateway && gateway.bonjour),
        deviceCount: db.prepare('SELECT COUNT(*) AS n FROM mobile_devices WHERE revoked_at IS NULL').get().n
    };
}

function createPairingCode() {
    if (!gateway) throw new Error('فعّل الاتصال بالهاتف أولاً');
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    pairing = { code, expiresAt: Date.now() + PAIR_TTL_MS, attempts: 0 };
    // A spiceerp:// link, not bare JSON: the in-app scanner reads it, and so does the phone's
    // own camera app, which then opens Spice ERP straight into pairing.
    const data = JSON.stringify({
        app: 'spice-erp', v: API_VERSION, name: desktopName(),
        port: gateway.port, hosts: getLanHosts().map((h) => h.address), code
    });
    const payload = `spiceerp://pair?d=${encodeURIComponent(data)}`;
    return { code, expiresAt: new Date(pairing.expiresAt).toISOString(), payload };
}

function listDevices() {
    return db.prepare(
        'SELECT id, name, created_at, last_seen_at, last_ip FROM mobile_devices WHERE revoked_at IS NULL ORDER BY created_at DESC'
    ).all();
}

function revokeDevice(id) {
    const result = db.prepare('UPDATE mobile_devices SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL').run(id);
    lastTouch.delete(id);
    return result.changes > 0;
}

module.exports = {
    init, start, stop, enable, disable, getStatus,
    createPairingCode, listDevices, revokeDevice,
    isPrivateAddress, isLoopback
};
