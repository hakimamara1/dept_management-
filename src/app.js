// app.js
const path = require('path');
// Explicit path — this process is spawned by Electron's main process with
// no guarantee its cwd is the repo root, so dotenv's cwd-relative default
// lookup can silently miss the .env file.
require('dotenv').config({ path: path.join(__dirname, '../.env') });
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
app.use('/uploads', express.static(path.join(__dirname, 'data/uploads')));

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