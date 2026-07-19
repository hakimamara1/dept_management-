// app.js
const fs = require('fs');
const path = require('path');
const { UPLOADS_DIR, ENV_PATH } = require('./config/paths');

// A packaged app's first run has no .env yet at ENV_PATH (userData) — write
// the same placeholder template that lives at the repo root in dev, so
// there's one discoverable, editable file for the Replicate token instead
// of needing to reach into the (read-only) app bundle. Never overwrites an
// existing file — this only seeds it once.
if (!fs.existsSync(ENV_PATH)) {
    fs.mkdirSync(path.dirname(ENV_PATH), { recursive: true });
    fs.writeFileSync(
        ENV_PATH,
        '# Replicate API token — used for AI invoice-photo extraction (google/gemini-3.1-pro).\n' +
        '# Get yours at https://replicate.com/account/api-tokens\n' +
        'REPLICATE_API_TOKEN=\n'
    );
}

// Explicit path — this process is spawned by Electron's main process with
// no guarantee its cwd is the repo root, so dotenv's cwd-relative default
// lookup can silently miss the .env file. In a packaged app ENV_PATH points
// into userData instead of next to the (read-only) app bundle — see
// docs/packaging.md.
require('dotenv').config({ path: ENV_PATH });
const express = require('express');
const cors = require('cors');

BigInt.prototype.toJSON = function () {
    return Number(this);
};
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Uploaded invoice-attachment photos — private business documents, not
// committed (see .gitignore). Reference/backup only, never read by
// business logic.
app.use('/uploads', express.static(UPLOADS_DIR));

// Routes
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/products', require('./routes/products'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/accounting', require('./routes/accounting'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/purchase-orders', require('./routes/purchaseOrders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/expiration-batches', require('./routes/expirationBatches'));
app.use('/api/settings', require('./routes/settings'));


// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', database: 'better-sqlite3', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message });
});


app.listen(3000, () => {
    console.log('Server started on port 3000');
});