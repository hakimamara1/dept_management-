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
    default_sale_price DECIMAL(10,2),      -- suggested selling price, separate from purchase cost above
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
    invoice_amount DECIMAL(15,2) NOT NULL,  -- ALWAYS = SUM(purchase_invoice_items.total_price), kept live — see business-rules.md
    ocr_header_total DECIMAL(15,2),        -- raw OCR-extracted header total, reference/validation only — never used in business logic
    ocr_supplier_name TEXT,                -- raw OCR-extracted supplier name, a hint shown on the review page only — never used to match/create a supplier (see business-rules.md)
    discount DECIMAL(15,2) DEFAULT 0,
    tax DECIMAL(15,2) DEFAULT 0,
    new_balance DECIMAL(15,2),
    payment_method TEXT,
    notes TEXT,
    status TEXT DEFAULT 'Pending Review',  -- 'Pending Review', 'Approved', 'Rejected'
    validation_errors JSON,                  -- SQLite: TEXT storing JSON array
    approved_at DATETIME,                  -- set once, at the moment of approval — see invoiceProcessor.approveInvoice
    source TEXT DEFAULT 'ocr',             -- 'ocr' (pasted OCR JSON) or 'manual' (typed in from a handwritten invoice)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    UNIQUE(invoice_number, supplier_id)    -- prevent duplicates per supplier
);

-- Photos of the physical invoice (mainly for manually-entered handwritten
-- invoices, but usable on any invoice) — backup documentation only, never
-- read by business logic.
CREATE TABLE IF NOT EXISTS invoice_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,               -- relative path under src/data/uploads/
    original_name TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(id)
);

CREATE TABLE IF NOT EXISTS purchase_invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    product_id INTEGER,                      -- NULL if unmatched/pending
    line_number INTEGER,
    ocr_product_name TEXT NOT NULL,        -- raw OCR name
    normalized_ocr_name TEXT,              -- normalized for matching
    package TEXT,
    unit TEXT,                             -- per-line unit of measure, editable pre-approval
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

-- ============================================
-- WHOLESALE CUSTOMERS (completely independent from inventory/stock/
-- accounting/suppliers — customer balance is never stored, always
-- computed as SUM(sales_invoices) - SUM(customer_payments); payments
-- are never allocated to a specific invoice, only to the account)
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- previous_balance/new_balance ARE stored here despite the "no stored
-- balance" rule above — they are a historical fact on an immutable
-- document (same pattern as purchase_invoices.previous_balance/new_balance),
-- not a live balance that could drift.
CREATE TABLE IF NOT EXISTS sales_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL,
    invoice_date DATE NOT NULL,
    invoice_amount DECIMAL(15,2) NOT NULL,
    previous_balance DECIMAL(15,2) NOT NULL,
    new_balance DECIMAL(15,2) NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- product_name is free text, deliberately NOT a FK to products — this
-- module must not touch the purchasing-side inventory catalog.
CREATE TABLE IF NOT EXISTS sales_invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    unit TEXT,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    line_total DECIMAL(15,2) NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id)
);

-- Never linked to a specific invoice — payments reduce the account
-- balance as a whole, not any one invoice.
CREATE TABLE IF NOT EXISTS customer_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    payment_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_method TEXT,
    notes TEXT,
    -- 'payment' (real payment, always positive, subtracts from balance) or
    -- 'adjustment' (manual correction, signed, added to balance — positive
    -- increases what the customer owes, negative decreases it). See
    -- customerService.adjustBalance and business-rules.md.
    transaction_type TEXT DEFAULT 'payment',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- ═══════════════════════════════════════════════════════════════
-- EXPIRATION TRACKING — fully independent module. The only link to the
-- rest of the schema is product_id; no FK to suppliers, invoices, or
-- stock_movements anywhere here, by design (see business-rules.md).
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS expiration_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    batch_number TEXT NOT NULL,
    manufacturing_date DATE,
    expiration_date DATE NOT NULL,
    quantity DECIMAL(10,2),
    unit TEXT,
    location TEXT,
    -- Only a meaningful stored value when terminal ('DISCARDED'/'SOLD', a
    -- user action). Otherwise ('ACTIVE' default) the real display status
    -- is always recomputed live from expiration_date — see business-rules.md.
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ═══════════════════════════════════════════════════════════════
-- SETTINGS — single-row table (id is always 1). No key-value indirection;
-- a fixed, directly-typed set of fields is simpler for the small, known
-- scope this covers (business identity for print headers).
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS business_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    business_name TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    tax_number TEXT,
    commercial_register TEXT,
    logo_path TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer ON sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_invoice ON sales_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_expiration_batches_product ON expiration_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_expiration_batches_expiration_date ON expiration_batches(expiration_date);
CREATE INDEX IF NOT EXISTS idx_expiration_batches_status ON expiration_batches(status);
CREATE INDEX IF NOT EXISTS idx_expiration_batches_batch_number ON expiration_batches(batch_number);