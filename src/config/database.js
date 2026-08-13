// config/database.js
const Database = require('better-sqlite3');
const path = require('path');
const QUERIES = require('../models/queries');
const fs = require('fs');
const { DB_PATH } = require('./paths');

class DatabaseManager {
    constructor() {
        const dbPath = DB_PATH;
        this.dbPath = dbPath; // exposed for settingsService's backup/restore

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
        this.runMigrations();
        this.initIndexes();
        this.initStatements();
        console.log("Database:", dbPath);
    }

    /**
     * Tables only. Indexes are deferred to initIndexes(), run after
     * runMigrations() — an index on a column a migration is about to add
     * would otherwise fail on an existing database, since CREATE TABLE IF
     * NOT EXISTS is a no-op for a table that's already there.
     */
    initSchema() {
        const schemaPath = path.join(__dirname, '../models/schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf8');
            const indexMarker = '-- Indexes for performance';
            const splitAt = schema.indexOf(indexMarker);
            if (splitAt === -1) {
                this.db.exec(schema);
            } else {
                this.db.exec(schema.slice(0, splitAt));
                this._indexSql = schema.slice(splitAt);
            }
        }
    }

    initIndexes() {
        if (this._indexSql) {
            this.db.exec(this._indexSql);
        }
    }

    /**
     * CREATE TABLE IF NOT EXISTS in schema.sql only helps brand-new
     * databases — it never adds a column to a table that already exists on
     * disk. Any column added to an existing table needs an explicit
     * ALTER TABLE here, guarded by a PRAGMA table_info check since SQLite
     * has no "ADD COLUMN IF NOT EXISTS". Keep this list append-only, in the
     * order columns were introduced.
     */
    runMigrations() {
        this._addColumnIfMissing('purchase_invoice_items', 'unit', 'TEXT');
        this._addColumnIfMissing('purchase_invoices', 'approved_at', 'DATETIME');
        this._addColumnIfMissing('purchase_invoices', 'ocr_header_total', 'DECIMAL(15,2)');
        this._addColumnIfMissing('products', 'default_sale_price', 'DECIMAL(10,2)');
        this._addColumnIfMissing('purchase_invoices', 'source', "TEXT DEFAULT 'ocr'");
        this._addColumnIfMissing('purchase_invoices', 'ocr_supplier_name', 'TEXT');
        this._addColumnIfMissing('customer_payments', 'transaction_type', "TEXT DEFAULT 'payment'");
        this._addColumnIfMissing('sales_invoices', 'status', "TEXT DEFAULT 'Final'");

        // Seed the settings singleton row once — GET never has to special-case "no row yet".
        this.db.prepare('INSERT OR IGNORE INTO business_profile (id) VALUES (1)').run();
    }

    _addColumnIfMissing(table, column, definition) {
        const existingColumns = this.db.prepare(`PRAGMA table_info(${table})`).all();
        const alreadyExists = existingColumns.some((col) => col.name === column);
        if (!alreadyExists) {
            this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
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
                getPriceHistory: this.db.prepare(QUERIES.products.getPriceHistory),
                insert: this.db.prepare(QUERIES.products.insert),
                updateSalePrice: this.db.prepare(QUERIES.products.updateSalePrice),
                update: this.db.prepare(QUERIES.products.update)
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
                updateStatus: this.db.prepare(QUERIES.purchaseOrders.updateStatus),
                update: this.db.prepare(QUERIES.purchaseOrders.update),
                updateItem: this.db.prepare(QUERIES.purchaseOrders.updateItem),
                deleteItem: this.db.prepare(QUERIES.purchaseOrders.deleteItem),
                countItems: this.db.prepare(QUERIES.purchaseOrders.countItems)
            },

            // Wholesale Customers
            customers: {
                getAll: this.db.prepare(QUERIES.customers.getAll),
                search: this.db.prepare(QUERIES.customers.search),
                getById: this.db.prepare(QUERIES.customers.getById),
                getSummary: this.db.prepare(QUERIES.customers.getSummary),
                insert: this.db.prepare(QUERIES.customers.insert),
                reports: {
                    getSummary: this.db.prepare(QUERIES.customers.reports.getSummary),
                    getLargestDebtors: this.db.prepare(QUERIES.customers.reports.getLargestDebtors),
                    getMostActive: this.db.prepare(QUERIES.customers.reports.getMostActive)
                }
            },

            // Sales Invoices (wholesale customers)
            salesInvoices: {
                getByCustomer: this.db.prepare(QUERIES.salesInvoices.getByCustomer),
                getById: this.db.prepare(QUERIES.salesInvoices.getById),
                getItemsByInvoice: this.db.prepare(QUERIES.salesInvoices.getItemsByInvoice),
                insert: this.db.prepare(QUERIES.salesInvoices.insert),
                updateInvoiceNumber: this.db.prepare(QUERIES.salesInvoices.updateInvoiceNumber),
                insertItem: this.db.prepare(QUERIES.salesInvoices.insertItem),
                updateItem: this.db.prepare(QUERIES.salesInvoices.updateItem),
                deleteItem: this.db.prepare(QUERIES.salesInvoices.deleteItem),
                countItems: this.db.prepare(QUERIES.salesInvoices.countItems),
                recalculateTotal: this.db.prepare(QUERIES.salesInvoices.recalculateTotal),
                updateNotes: this.db.prepare(QUERIES.salesInvoices.updateNotes),
                approve: this.db.prepare(QUERIES.salesInvoices.approve),
                deleteInvoice: this.db.prepare(QUERIES.salesInvoices.deleteInvoice),
                deleteItemsByInvoice: this.db.prepare(QUERIES.salesInvoices.deleteItemsByInvoice),
                getCustomerBalance: this.db.prepare(QUERIES.salesInvoices.getCustomerBalance),
                getStatement: this.db.prepare(QUERIES.salesInvoices.getStatement)
            },

            // Customer Payments
            customerPayments: {
                getByCustomer: this.db.prepare(QUERIES.customerPayments.getByCustomer),
                insert: this.db.prepare(QUERIES.customerPayments.insert),
                insertAdjustment: this.db.prepare(QUERIES.customerPayments.insertAdjustment)
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
                  previous_balance, invoice_amount, ocr_header_total, discount, tax, new_balance,
                  payment_method, notes, status, validation_errors, source, ocr_supplier_name)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ),
            insertInvoiceItem: this.db.prepare(
                `INSERT INTO purchase_invoice_items
                 (invoice_id, product_id, line_number, ocr_product_name, normalized_ocr_name,
                  package, unit, quantity, unit_price, discount, tax, total_price,
                  match_status, match_confidence, suggested_product_id, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ),
            updateInvoiceItem: this.db.prepare(
                `UPDATE purchase_invoice_items
                 SET ocr_product_name = ?, unit = ?, quantity = ?, unit_price = ?, total_price = ?,
                     product_id = ?, match_status = ?
                 WHERE id = ?`
            ),
            deleteInvoiceItem: this.db.prepare('DELETE FROM purchase_invoice_items WHERE id = ?'),
            countInvoiceItems: this.db.prepare('SELECT COUNT(*) as count FROM purchase_invoice_items WHERE invoice_id = ?'),
            getMaxLineNumber: this.db.prepare('SELECT MAX(line_number) as maxLine FROM purchase_invoice_items WHERE invoice_id = ?'),
            countUnmatchedItems: this.db.prepare(
                `SELECT COUNT(*) as count FROM purchase_invoice_items WHERE invoice_id = ? AND product_id IS NULL`
            ),
            // Keeps invoice_amount permanently in sync with the items — the
            // calculated total is the single source of truth (business-rules.md).
            // Called at the end of every item add/edit/delete.
            recalculateInvoiceTotal: this.db.prepare(
                `UPDATE purchase_invoices
                 SET invoice_amount = (SELECT COALESCE(SUM(total_price), 0) FROM purchase_invoice_items WHERE invoice_id = ?)
                 WHERE id = ?`
            ),
            updateInvoiceNotes: this.db.prepare('UPDATE purchase_invoices SET notes = ? WHERE id = ?'),
            updateInvoiceSupplier: this.db.prepare('UPDATE purchase_invoices SET supplier_id = ? WHERE id = ?'),
            updateInvoiceStatus: this.db.prepare(
                'UPDATE purchase_invoices SET status = ? WHERE id = ?'
            ),
            // Used only by approveInvoice — stamps approved_at at the exact
            // moment of approval, for the read-only view page's header.
            approveInvoiceStatus: this.db.prepare(
                `UPDATE purchase_invoices SET status = 'Approved', approved_at = CURRENT_TIMESTAMP WHERE id = ?`
            ),
            insertInvoiceAttachment: this.db.prepare(
                `INSERT INTO invoice_attachments (invoice_id, file_path, original_name)
                 VALUES (?, ?, ?)`
            ),
            getInvoiceAttachments: this.db.prepare(
                `SELECT * FROM invoice_attachments WHERE invoice_id = ? ORDER BY uploaded_at ASC`
            ),
            getInvoiceAttachmentById: this.db.prepare('SELECT * FROM invoice_attachments WHERE id = ?'),
            deleteInvoiceAttachment: this.db.prepare('DELETE FROM invoice_attachments WHERE id = ?'),
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
                 LEFT JOIN suppliers s ON pi.supplier_id = s.id
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
            ),

            // Expiration Tracking — fully independent module (see business-rules.md)
            expirationBatches: {
                getAll: this.db.prepare(QUERIES.expirationBatches.getAll),
                getById: this.db.prepare(QUERIES.expirationBatches.getById),
                insert: this.db.prepare(QUERIES.expirationBatches.insert),
                update: this.db.prepare(QUERIES.expirationBatches.update),
                updateStatus: this.db.prepare(QUERIES.expirationBatches.updateStatus),
                delete: this.db.prepare(QUERIES.expirationBatches.delete),
                getDashboardSummary: this.db.prepare(QUERIES.expirationBatches.getDashboardSummary)
            },

            // Settings
            businessProfile: {
                get: this.db.prepare(QUERIES.businessProfile.get),
                update: this.db.prepare(QUERIES.businessProfile.update),
                updateLogo: this.db.prepare(QUERIES.businessProfile.updateLogo)
            }
        };
    }

    // Synchronous API — no async/await needed!
    prepare(sql) {
        return this.db.prepare(sql);
    }

    exec(sql) {
        return this.db.exec(sql);
    }

    pragma(sql) {
        return this.db.pragma(sql);
    }

    transaction(fn) {
        // better-sqlite3 has built-in transactions
        return this.db.transaction(fn);
    }

    close() {
        this.db.close();
    }

    // Graceful-shutdown path only. A plain close() does not force a
    // checkpoint — WAL frames stay in invoices.db-wal until SQLite's default
    // passive autocheckpoint (every ~1000 pages) happens to run, which never
    // truncates the WAL file back down. TRUNCATE both merges every WAL frame
    // into the main file AND shrinks the WAL to 0 bytes, so invoices.db alone
    // is a complete, restorable snapshot the moment this returns.
    checkpointAndClose() {
        try {
            this.db.pragma('wal_checkpoint(TRUNCATE)');
        } catch (err) {
            // Still close even if the checkpoint itself fails (e.g. another
            // connection briefly holds a read lock) — an unmerged WAL is
            // recoverable on next open; a connection left dangling is worse.
            console.error('[database] WAL checkpoint before close failed:', err.message);
        }
        this.db.close();
    }

    // SQLite's online backup API (sqlite3_backup_*) — takes a consistent
    // snapshot of a live database regardless of WAL state or concurrent
    // writers, without blocking them. This is the correct primitive for "back
    // up while the app might still be running," as opposed to checkpoint +
    // raw file copy, which is only safe when nothing else can write during
    // the gap between the two steps.
    backupTo(destPath) {
        return this.db.backup(destPath);
    }

    // For routes that need raw access
    get raw() {
        return this.db;
    }
}


module.exports = new DatabaseManager();