// app.js
const express = require('express');
const cors = require('cors');

BigInt.prototype.toJSON = function () {
    return Number(this);
};
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/products', require('./routes/products'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/accounting', require('./routes/accounting'));
app.use('/api/analytics', require('./routes/analytics'));


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