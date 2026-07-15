// config/database.js
const Database = require('better-sqlite3');
const path = require('path');
const QUERIES = require('../models/queries');
const fs = require('fs');

class DatabaseManager {
    constructor() {
        const dbPath = path.join(__dirname, '../data/invoices.db');

        // Ensure data directory exists
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        this.db = new Database(dbPath);

        // Performance & safety settings
        this.db.pragma('journal_mode = WAL');        // Write-Ahead Logging (faster)
        this.db.pragma('foreign_keys = ON');           // Enforce FK constraints
        this.db.pragma('synchronous = NORMAL');        // Balance safety/speed
        this.db.pragma('temp_store = memory');         // Faster temp tables
        this.db.pragma('mmap_size = 30000000000');    // Memory-map large DBs

        // NOTE: defaultSafeIntegers is intentionally OFF.
        // DECIMAL/REAL columns return plain JS numbers from SQLite.
        // BigInt would break arithmetic like (balance + invoiceAmount).

        this.initSchema();
        this.initStatements();
    }

    initSchema() {
        const schemaPath = path.join(__dirname, '../models/schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf8');
            this.db.exec(schema);
        }
    }

    /**
     * Prepare reusable statements for hot paths.
     * This is where better-sqlite3 shines — prepared statements are ~3x faster.
     */
    initStatements() {
        // Product matching hot paths
        this.stmts = {
            stock: {
                insert: this.db.prepare(QUERIES.stock.insert),
                getByProduct: this.db.prepare(QUERIES.stock.getByProduct),
                getCurrent: this.db.prepare(QUERIES.stock.getCurrent),
                getCurrentWithCost: this.db.prepare(QUERIES.stock.getCurrentWithCost),
                getMovementsByDate: this.db.prepare(QUERIES.stock.getMovementsByDate),
                getProductStockSummary: this.db.prepare(QUERIES.stock.getProductStockSummary),
                getStockValueTotal: this.db.prepare(QUERIES.stock.getStockValueTotal),
                getLowStock: this.db.prepare(QUERIES.products.getLowStock)
            },

            // Products
            products: {
                getPriceHistory: this.db.prepare(QUERIES.products.getPriceHistory)
            },

            // Invoices
            invoices: {
                getMonthlyTotals: this.db.prepare(QUERIES.invoices.getMonthlyTotals)
            },

            // Purchase Orders
            purchaseOrders: {
                getAll: this.db.prepare(QUERIES.purchaseOrders.getAll),
                getById: this.db.prepare(QUERIES.purchaseOrders.getById),
                getItemsByOrder: this.db.prepare(QUERIES.purchaseOrders.getItemsByOrder),
                insert: this.db.prepare(QUERIES.purchaseOrders.insert),
                insertItem: this.db.prepare(QUERIES.purchaseOrders.insertItem),
                updateStatus: this.db.prepare(QUERIES.purchaseOrders.updateStatus)
            },

            // Suppliers
            suppliers: {
                getById: this.db.prepare(QUERIES.suppliers.getById),
                getByName: this.db.prepare(QUERIES.suppliers.getByName),
                getAll: this.db.prepare(QUERIES.suppliers.getAll),
                insert: this.db.prepare(QUERIES.suppliers.insert),
                updateBalance: this.db.prepare(QUERIES.suppliers.updateBalance),
                search: this.db.prepare(QUERIES.suppliers.search)
            },

            // Debt
            debt: {
                insertTransaction: this.db.prepare(QUERIES.debt.insertTransaction),
                getBySupplier: this.db.prepare(QUERIES.debt.getBySupplier),
                getBalance: this.db.prepare(QUERIES.debt.getBalance),
                getSupplierLedger: this.db.prepare(QUERIES.debt.getSupplierLedger),
                getAgingReport: this.db.prepare(QUERIES.debt.getAgingReport),
                getAllPayments: this.db.prepare(QUERIES.debt.getAllPayments)
            },

            // Accounting
            accounting: {
                insert: this.db.prepare(QUERIES.accounting.insert),
                getByAccount: this.db.prepare(QUERIES.accounting.getByAccount),
                getTrialBalance: this.db.prepare(QUERIES.accounting.getTrialBalance),
                getByDateRange: this.db.prepare(QUERIES.accounting.getByDateRange),
                getJournalEntry: this.db.prepare(QUERIES.accounting.getJournalEntry)
            },

            // Analytics
            analytics: {
                upsert: this.db.prepare(QUERIES.analytics.upsert),
                getTopProducts: this.db.prepare(QUERIES.analytics.getTopProducts),
                getDashboardStats: this.db.prepare(QUERIES.analytics.getDashboardStats)
            },

            getAlias: this.db.prepare(
                `SELECT pa.*, p.id as product_id, p.name as product_name, p.unit, p.current_stock
                 FROM product_aliases pa
                 JOIN products p ON pa.product_id = p.id
                 WHERE pa.normalized_alias = ?`
            ),
            getProductById: this.db.prepare('SELECT * FROM products WHERE id = ?'),
            getAllProducts: this.db.prepare('SELECT id, name FROM products'),
            getProductByName: this.db.prepare('SELECT * FROM products WHERE id = ?'),
            insertAlias: this.db.prepare(
                `INSERT INTO product_aliases (product_id, alias, normalized_alias, source, confidence_score)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(normalized_alias) DO UPDATE SET
                 usage_count = usage_count + 1,
                 confidence_score = MAX(confidence_score, excluded.confidence_score)`
            ),
            getSupplierByName: this.db.prepare('SELECT * FROM suppliers WHERE LOWER(name) = LOWER(?)'),
            getAllSuppliers: this.db.prepare('SELECT id, name FROM suppliers'),
            insertSupplier: this.db.prepare(
                `INSERT INTO suppliers (name, phone, email, address, tax_number, commercial_register)
                 VALUES (?, ?, ?, ?, ?, ?)`
            ),
            getInvoiceByNumber: this.db.prepare(
                `SELECT pi.*, s.name as supplier_name 
                 FROM purchase_invoices pi 
                 JOIN suppliers s ON pi.supplier_id = s.id 
                 WHERE pi.invoice_number = ? AND s.name = ?`
            ),
            insertInvoice: this.db.prepare(
                `INSERT INTO purchase_invoices 
                 (invoice_number, invoice_date, invoice_time, supplier_id, currency,
                  previous_balance, invoice_amount, discount, tax, new_balance,
                  payment_method, notes, status, validation_errors)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ),
            insertInvoiceItem: this.db.prepare(
                `INSERT INTO purchase_invoice_items
                 (invoice_id, product_id, line_number, ocr_product_name, normalized_ocr_name,
                  package, quantity, unit_price, discount, tax, total_price,
                  match_status, match_confidence, suggested_product_id, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ),
            updateInvoiceStatus: this.db.prepare(
                'UPDATE purchase_invoices SET status = ? WHERE id = ?'
            ),
            insertStockMovement: this.db.prepare(
                `INSERT INTO stock_movements 
                 (product_id, invoice_id, movement_type, quantity, unit_cost, reference)
                 VALUES (?, ?, ?, ?, ?, ?)`
            ),
            getStockSum: this.db.prepare(
                'SELECT COALESCE(SUM(quantity), 0) as stock FROM stock_movements WHERE product_id = ?'
            ),
            getStockData: this.db.prepare(
                `SELECT SUM(quantity) as total_qty, SUM(quantity * unit_cost) as total_cost
                 FROM stock_movements WHERE product_id = ?`
            ),
            insertSupplierTransaction: this.db.prepare(
                `INSERT INTO supplier_transactions
                 (supplier_id, invoice_id, transaction_type, amount, balance_after, description)
                 VALUES (?, ?, ?, ?, ?, ?)`
            ),
            updateSupplierBalance: this.db.prepare(
                'UPDATE suppliers SET current_balance = ? WHERE id = ?'
            ),
            updateProductCost: this.db.prepare(
                `UPDATE products SET last_purchase_price = ?, average_cost = ? WHERE id = ?`
            ),
            insertAccounting: this.db.prepare(
                `INSERT INTO accounting_transactions
                 (invoice_id, transaction_date, account_code, debit, credit, description)
                 VALUES (?, ?, ?, ?, ?, ?)`
            ),
            upsertAnalytics: this.db.prepare(
                `INSERT INTO product_analytics (product_id, total_purchased, last_purchase_date)
                 VALUES (?, ?, ?)
                 ON CONFLICT(product_id) DO UPDATE SET
                 total_purchased = total_purchased + excluded.total_purchased,
                 last_purchase_date = excluded.last_purchase_date`
            ),
            getInvoiceWithSupplier: this.db.prepare(
                `SELECT pi.*, s.current_balance as supplier_balance
                 FROM purchase_invoices pi
                 JOIN suppliers s ON pi.supplier_id = s.id
                 WHERE pi.id = ?`
            ),
            getInvoiceItems: this.db.prepare(
                `SELECT pii.*, p.name as product_name, p.current_stock
                 FROM purchase_invoice_items pii
                 LEFT JOIN products p ON pii.product_id = p.id
                 WHERE pii.invoice_id = ?`
            ),
            updateItemProduct: this.db.prepare(
                'UPDATE purchase_invoice_items SET product_id = ?, match_status = ? WHERE id = ?'
            ),
            getPendingInvoices: this.db.prepare(
                `SELECT pi.*, s.name as supplier_name,
                        COUNT(pii.id) as total_items,
                        SUM(CASE WHEN pii.match_status = 'Pending' THEN 1 ELSE 0 END) as pending_items
                 FROM purchase_invoices pi
                 JOIN suppliers s ON pi.supplier_id = s.id
                 LEFT JOIN purchase_invoice_items pii ON pi.id = pii.invoice_id
                 WHERE pi.status = 'Pending Review'
                 GROUP BY pi.id`
            ),
            getReviewData: this.db.prepare(
                `SELECT pii.*, 
                        p.name as matched_product_name,
                        sp.name as suggested_product_name
                 FROM purchase_invoice_items pii
                 LEFT JOIN products p ON pii.product_id = p.id
                 LEFT JOIN products sp ON pii.suggested_product_id = sp.id
                 WHERE pii.invoice_id = ?`
            )
        };
    }

    // Synchronous API — no async/await needed!
    prepare(sql) {
        return this.db.prepare(sql);
    }

    exec(sql) {
        return this.db.exec(sql);
    }

    transaction(fn) {
        // better-sqlite3 has built-in transactions
        return this.db.transaction(fn);
    }

    close() {
        this.db.close();
    }

    // For routes that need raw access
    get raw() {
        return this.db;
    }
}


module.exports = new DatabaseManager();