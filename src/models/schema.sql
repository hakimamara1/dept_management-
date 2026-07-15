-- ============================================
-- CORE TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- SERIAL in PostgreSQL
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    tax_number TEXT,
    commercial_register TEXT,
    current_balance DECIMAL(15,2) DEFAULT 0.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                    -- canonical name: "زيت الكابتن 250ml"
    barcode TEXT,
    category TEXT,
    unit TEXT,                             -- 'piece', 'kg', 'box'
    current_stock DECIMAL(10,2) DEFAULT 0, -- derived from SUM(stock_movements)
    last_purchase_price DECIMAL(10,2),
    average_cost DECIMAL(10,2),            -- weighted average cost
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- CRITICAL: Maps OCR names to canonical products
CREATE TABLE IF NOT EXISTS product_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    alias TEXT NOT NULL,                   -- OCR-extracted name: "زيت الكابتن"
    normalized_alias TEXT NOT NULL,        -- normalized for matching
    confidence_score DECIMAL(3,2),         -- how sure we are about this alias
    source TEXT DEFAULT 'manual',          -- 'manual', 'ai', 'user_confirmed'
    usage_count INTEGER DEFAULT 1,         -- how many times this alias was used
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    UNIQUE(normalized_alias)
);

CREATE TABLE IF NOT EXISTS purchase_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    invoice_time TIME,
    supplier_id INTEGER,
    currency TEXT DEFAULT 'دج',
    previous_balance DECIMAL(15,2),
    invoice_amount DECIMAL(15,2) NOT NULL,
    discount DECIMAL(15,2) DEFAULT 0,
    tax DECIMAL(15,2) DEFAULT 0,
    new_balance DECIMAL(15,2),
    payment_method TEXT,
    notes TEXT,
    status TEXT DEFAULT 'Pending Review',  -- 'Pending Review', 'Approved', 'Rejected'
    validation_errors JSON,                  -- SQLite: TEXT storing JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    UNIQUE(invoice_number, supplier_id)    -- prevent duplicates per supplier
);

CREATE TABLE IF NOT EXISTS purchase_invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    product_id INTEGER,                      -- NULL if unmatched/pending
    line_number INTEGER,
    ocr_product_name TEXT NOT NULL,        -- raw OCR name
    normalized_ocr_name TEXT,              -- normalized for matching
    package TEXT,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    total_price DECIMAL(10,2) NOT NULL,
    match_status TEXT DEFAULT 'Pending',   -- 'Pending', 'Matched', 'NewProduct', 'UserSelected'
    match_confidence DECIMAL(3,2),         -- AI confidence in match
    suggested_product_id INTEGER,
    user_selected_product_id INTEGER,
    notes TEXT,
    FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (suggested_product_id) REFERENCES products(id),
    FOREIGN KEY (user_selected_product_id) REFERENCES products(id)
);

-- NEVER update stock directly. Always insert here.
CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    invoice_id INTEGER,
    movement_type TEXT NOT NULL,           -- 'purchase', 'sale', 'adjustment', 'return'
    quantity DECIMAL(10,2) NOT NULL,       -- positive = in, negative = out
    unit_cost DECIMAL(10,2),
    reference TEXT,                        -- invoice number or reason
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(id)
);

-- Supplier debt tracking (ledger style)
CREATE TABLE IF NOT EXISTS supplier_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    invoice_id INTEGER,
    transaction_type TEXT NOT NULL,        -- 'invoice', 'payment', 'adjustment'
    amount DECIMAL(15,2) NOT NULL,         -- positive = debt increase, negative = payment
    balance_after DECIMAL(15,2) NOT NULL,  -- running balance snapshot
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(id)
);

-- Simple accounting (can expand later)
CREATE TABLE IF NOT EXISTS accounting_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER,
    transaction_date DATE NOT NULL,
    account_code TEXT NOT NULL,            -- 'inventory', 'accounts_payable', 'expenses'
    debit DECIMAL(15,2) DEFAULT 0,
    credit DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(id)
);

-- For analytics (pre-computed to avoid heavy SUM queries)
CREATE TABLE IF NOT EXISTS product_analytics (
    product_id INTEGER PRIMARY KEY,
    total_purchased DECIMAL(15,2) DEFAULT 0,
    total_sold DECIMAL(15,2) DEFAULT 0,
    last_purchase_date DATE,
    last_sale_date DATE,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- PURCHASE ORDERS (tracking/intent only — no stock, debt, or
-- accounting effects here; those still only happen when the real
-- invoice arrives through the OCR pipeline)
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft',   -- 'Draft', 'Sent', 'Received', 'Cancelled'
    order_date DATE NOT NULL,
    expected_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    expected_unit_price DECIMAL(10,2),
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_aliases_normalized ON product_aliases(normalized_alias);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON purchase_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON purchase_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_items_invoice ON purchase_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_items_product ON purchase_invoice_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_trans_supplier ON supplier_transactions(supplier_id);