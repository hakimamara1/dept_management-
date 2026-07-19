// models/queries.js
/**
 * Centralized query definitions for better-sqlite3.
 * All prepared statements are defined here and initialized in database.js.
 * This makes it easy to find/audit any SQL in the system.
 */

const QUERIES = {
  // ─── SUPPLIERS ───
  suppliers: {
    getById: `SELECT * FROM suppliers WHERE id = ?`,
    getByName: `SELECT * FROM suppliers WHERE LOWER(name) = LOWER(?)`,
    getAll: `SELECT * FROM suppliers ORDER BY name`,
    insert: `INSERT INTO suppliers (name, phone, email, address, tax_number, commercial_register, current_balance)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
    updateBalance: `UPDATE suppliers SET current_balance = ? WHERE id = ?`,
    search: `SELECT * FROM suppliers WHERE name LIKE ? ORDER BY name LIMIT 20`
  },

  // ─── PRODUCTS ───
  products: {
    getById: `SELECT * FROM products WHERE id = ?`,
    getByName: `SELECT * FROM products WHERE LOWER(name) = LOWER(?)`,
    getAll: `SELECT * FROM products ORDER BY name`,
    // Cost fields (last_purchase_price/average_cost) are deliberately absent
    // here — they start NULL and are only ever written by updateCost, at
    // invoice approval. A newly created product has no purchase history yet.
    insert: `INSERT INTO products (name, barcode, category, unit, default_sale_price)
                 VALUES (?, ?, ?, ?, ?)`,
    updateCost: `UPDATE products SET last_purchase_price = ?, average_cost = ? WHERE id = ?`,
    updateSalePrice: `UPDATE products SET default_sale_price = ? WHERE id = ?`,
    update: `UPDATE products SET name = ?, barcode = ?, category = ?, unit = ? WHERE id = ?`,
    search: `SELECT p.*, COALESCE(SUM(sm.quantity), 0) as computed_stock
                 FROM products p
                 LEFT JOIN stock_movements sm ON p.id = sm.product_id
                 WHERE p.name LIKE ? OR p.barcode LIKE ?
                 GROUP BY p.id
                 ORDER BY p.name
                 LIMIT 20`,
    // NOTE: HAVING repeats the aggregate expression rather than referencing
    // the "current_stock" alias — products has its own (always-stale, never-
    // written-to) current_stock column, and SQLite resolves a bare identifier
    // in HAVING against real columns in scope before SELECT-list aliases, so
    // `HAVING current_stock < ?` was silently comparing against that stale
    // column (always 0) and returning every product regardless of threshold.
    getLowStock: `SELECT p.*, COALESCE(SUM(sm.quantity), 0) as current_stock
                      FROM products p
                      LEFT JOIN stock_movements sm ON p.id = sm.product_id
                      GROUP BY p.id
                      HAVING COALESCE(SUM(sm.quantity), 0) < ?
                      ORDER BY current_stock ASC`,
    getPriceHistory: `SELECT
                             pii.unit_price,
                             pii.quantity,
                             pii.discount,
                             pi.invoice_date,
                             pi.invoice_number,
                             s.name as supplier_name
                           FROM purchase_invoice_items pii
                           JOIN purchase_invoices pi ON pii.invoice_id = pi.id
                           JOIN suppliers s ON pi.supplier_id = s.id
                           WHERE pii.product_id = ? AND pi.status = 'Approved'
                           ORDER BY pi.invoice_date ASC, pi.id ASC`
  },

  // ─── PRODUCT ALIASES ───
  aliases: {
    getByNormalized: `SELECT pa.*, p.name as product_name, p.unit, p.current_stock
                           FROM product_aliases pa
                           JOIN products p ON pa.product_id = p.id
                           WHERE pa.normalized_alias = ?`,
    getByProduct: `SELECT * FROM product_aliases WHERE product_id = ?`,
    insert: `INSERT INTO product_aliases (product_id, alias, normalized_alias, source, confidence_score)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(normalized_alias) DO UPDATE SET
                 usage_count = usage_count + 1,
                 confidence_score = MAX(confidence_score, excluded.confidence_score)`,
    getTopAliases: `SELECT alias, usage_count, confidence_score
                         FROM product_aliases
                         WHERE product_id = ?
                         ORDER BY usage_count DESC
                         LIMIT 10`
  },

  // ─── INVOICES ───
  invoices: {
    getById: `SELECT pi.*, s.name as supplier_name, s.current_balance as supplier_current_balance
                   FROM purchase_invoices pi
                   JOIN suppliers s ON pi.supplier_id = s.id
                   WHERE pi.id = ?`,
    getByNumberAndSupplier: `SELECT pi.*, s.name as supplier_name
                                   FROM purchase_invoices pi
                                   JOIN suppliers s ON pi.supplier_id = s.id
                                   WHERE pi.invoice_number = ? AND s.name = ?`,
    getPending: `SELECT pi.*, s.name as supplier_name,
                            COUNT(pii.id) as total_items,
                            SUM(CASE WHEN pii.match_status = 'Pending' THEN 1 ELSE 0 END) as pending_items
                     FROM purchase_invoices pi
                     JOIN suppliers s ON pi.supplier_id = s.id
                     LEFT JOIN purchase_invoice_items pii ON pi.id = pii.invoice_id
                     WHERE pi.status = 'Pending Review'
                     GROUP BY pi.id
                     ORDER BY pi.created_at DESC`,
    getApproved: `SELECT pi.*, s.name as supplier_name
                      FROM purchase_invoices pi
                      JOIN suppliers s ON pi.supplier_id = s.id
                      WHERE pi.status = 'Approved'
                      ORDER BY pi.invoice_date DESC
                      LIMIT ? OFFSET ?`,
    insert: `INSERT INTO purchase_invoices
                 (invoice_number, invoice_date, invoice_time, supplier_id, currency,
                  previous_balance, invoice_amount, discount, tax, new_balance,
                  payment_method, notes, status, validation_errors)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    updateStatus: `UPDATE purchase_invoices SET status = ? WHERE id = ?`,
    getMonthlyTotals: `SELECT 
                                strftime('%Y-%m', invoice_date) as month,
                                COUNT(*) as invoice_count,
                                SUM(invoice_amount) as total_amount,
                                SUM(discount) as total_discount
                             FROM purchase_invoices
                             WHERE status = 'Approved'
                             GROUP BY month
                             ORDER BY month DESC`
  },

  // ─── INVOICE ITEMS ───
  invoiceItems: {
    getByInvoice: `SELECT pii.*,
                               p.name as matched_product_name,
                               sp.name as suggested_product_name,
                               up.name as user_selected_product_name
                        FROM purchase_invoice_items pii
                        LEFT JOIN products p ON pii.product_id = p.id
                        LEFT JOIN products sp ON pii.suggested_product_id = sp.id
                        LEFT JOIN products up ON pii.user_selected_product_id = up.id
                        WHERE pii.invoice_id = ?
                        ORDER BY pii.line_number`,
    getPendingItems: `SELECT pii.*, pi.invoice_number, pi.invoice_date, s.name as supplier_name
                          FROM purchase_invoice_items pii
                          JOIN purchase_invoices pi ON pii.invoice_id = pi.id
                          JOIN suppliers s ON pi.supplier_id = s.id
                          WHERE pii.match_status = 'Pending'
                          ORDER BY pi.created_at DESC`,
    insert: `INSERT INTO purchase_invoice_items
                 (invoice_id, product_id, line_number, ocr_product_name, normalized_ocr_name,
                  package, quantity, unit_price, discount, tax, total_price,
                  match_status, match_confidence, suggested_product_id, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    updateProductMatch: `UPDATE purchase_invoice_items
                             SET product_id = ?, match_status = ?, user_selected_product_id = ?
                             WHERE id = ?`,
    getItemsByProduct: `SELECT pii.*, pi.invoice_date, pi.invoice_number, s.name as supplier_name
                              FROM purchase_invoice_items pii
                              JOIN purchase_invoices pi ON pii.invoice_id = pi.id
                              JOIN suppliers s ON pi.supplier_id = s.id
                              WHERE pii.product_id = ?
                              ORDER BY pi.invoice_date DESC`
  },

  // ─── STOCK MOVEMENTS ───
  stock: {
    insert: `INSERT INTO stock_movements
                 (product_id, invoice_id, movement_type, quantity, unit_cost, reference)
                 VALUES (?, ?, ?, ?, ?, ?)`,
    getByProduct: `SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC`,
    getCurrent: `SELECT COALESCE(SUM(quantity), 0) as stock FROM stock_movements WHERE product_id = ?`,
    getCurrentWithCost: `SELECT 
                                  COALESCE(SUM(quantity), 0) as total_qty,
                                  COALESCE(SUM(quantity * unit_cost), 0) as total_cost
                               FROM stock_movements WHERE product_id = ?`,
    getMovementsByDate: `SELECT sm.*, p.name as product_name
                               FROM stock_movements sm
                               JOIN products p ON sm.product_id = p.id
                               WHERE date(sm.created_at) BETWEEN ? AND ?
                               ORDER BY sm.created_at DESC`,
    getProductStockSummary: `SELECT 
                                    p.id, p.name, p.unit,
                                    COALESCE(SUM(sm.quantity), 0) as current_stock,
                                    p.average_cost,
                                    (COALESCE(SUM(sm.quantity), 0) * p.average_cost) as stock_value
                                 FROM products p
                                 LEFT JOIN stock_movements sm ON p.id = sm.product_id
                                 GROUP BY p.id
                                 ORDER BY p.name`,
    getStockValueTotal: `SELECT 
                                SUM(COALESCE(sm.quantity, 0) * COALESCE(sm.unit_cost, 0)) as total_value
                             FROM stock_movements sm`
  },

  // ─── SUPPLIER TRANSACTIONS (DEBT) ───
  debt: {
    insertTransaction: `INSERT INTO supplier_transactions
                            (supplier_id, invoice_id, transaction_type, amount, balance_after, description)
                            VALUES (?, ?, ?, ?, ?, ?)`,
    getBySupplier: `SELECT * FROM supplier_transactions
                        WHERE supplier_id = ?
                        ORDER BY created_at DESC`,
    getBalance: `SELECT balance_after
                     FROM supplier_transactions
                     WHERE supplier_id = ?
                     ORDER BY created_at DESC
                     LIMIT 1`,
    getSupplierLedger: `SELECT 
                                st.*,
                                pi.invoice_number,
                                pi.invoice_date
                             FROM supplier_transactions st
                             LEFT JOIN purchase_invoices pi ON st.invoice_id = pi.id
                             WHERE st.supplier_id = ?
                             ORDER BY st.created_at DESC`,
    getAgingReport: `SELECT 
                            s.id, s.name, s.current_balance,
                            SUM(CASE WHEN pi.invoice_date >= date('now', '-30 days') THEN pi.invoice_amount ELSE 0 END) as _0_30,
                            SUM(CASE WHEN pi.invoice_date >= date('now', '-60 days') AND pi.invoice_date < date('now', '-30 days') THEN pi.invoice_amount ELSE 0 END) as _30_60,
                            SUM(CASE WHEN pi.invoice_date >= date('now', '-90 days') AND pi.invoice_date < date('now', '-60 days') THEN pi.invoice_amount ELSE 0 END) as _60_90,
                            SUM(CASE WHEN pi.invoice_date < date('now', '-90 days') THEN pi.invoice_amount ELSE 0 END) as _90_plus
                           FROM suppliers s
                           LEFT JOIN purchase_invoices pi ON s.id = pi.supplier_id AND pi.status = 'Approved'
                           GROUP BY s.id
                           ORDER BY s.current_balance DESC`,
    getTopDebtors: `SELECT name, current_balance FROM suppliers ORDER BY current_balance DESC LIMIT 10`,
    getAllPayments: `SELECT st.*, s.name as supplier_name
                          FROM supplier_transactions st
                          JOIN suppliers s ON st.supplier_id = s.id
                          WHERE st.transaction_type = 'payment'
                          ORDER BY st.created_at DESC`
  },

  // ─── ACCOUNTING ───
  accounting: {
    insert: `INSERT INTO accounting_transactions
                 (invoice_id, transaction_date, account_code, debit, credit, description)
                 VALUES (?, ?, ?, ?, ?, ?)`,
    getByAccount: `SELECT * FROM accounting_transactions
                        WHERE account_code = ?
                        ORDER BY transaction_date DESC`,
    getTrialBalance: `SELECT 
                            account_code,
                            SUM(debit) as total_debit,
                            SUM(credit) as total_credit,
                            (SUM(debit) - SUM(credit)) as balance
                           FROM accounting_transactions
                           GROUP BY account_code`,
    getByDateRange: `SELECT * FROM accounting_transactions
                          WHERE transaction_date BETWEEN ? AND ?
                          ORDER BY transaction_date, id`,
    getJournalEntry: `SELECT * FROM accounting_transactions WHERE invoice_id = ? ORDER BY id`
  },

  // ─── ANALYTICS ───
  analytics: {
    upsert: `INSERT INTO product_analytics (product_id, total_purchased, last_purchase_date)
                  VALUES (?, ?, ?)
                  ON CONFLICT(product_id) DO UPDATE SET
                  total_purchased = total_purchased + excluded.total_purchased,
                  last_purchase_date = excluded.last_purchase_date`,
    getTopProducts: `SELECT 
                            p.name,
                            pa.total_purchased,
                            pa.last_purchase_date,
                            COUNT(pii.id) as purchase_count
                          FROM product_analytics pa
                          JOIN products p ON pa.product_id = p.id
                          LEFT JOIN purchase_invoice_items pii ON p.id = pii.product_id
                          GROUP BY pa.product_id
                          ORDER BY pa.total_purchased DESC
                          LIMIT 20`,
    getDashboardStats: `SELECT
                                (SELECT COUNT(*) FROM purchase_invoices WHERE status = 'Pending Review') as pending_invoices,
                                (SELECT COUNT(*) FROM purchase_invoices WHERE status = 'Approved') as approved_invoices,

                                (SELECT COALESCE(SUM(invoice_amount), 0) FROM purchase_invoices WHERE status = 'Approved') as total_purchases,
                                (SELECT COALESCE(SUM(current_balance), 0) FROM suppliers) as total_debt,
                                (SELECT COUNT(*) FROM products) as total_products,
                                (SELECT COUNT(*) FROM product_aliases) as total_aliases`
  },

  // ─── PURCHASE ORDERS ───
  purchaseOrders: {
    getAll: `SELECT
                    po.*,
                    s.name as supplier_name,
                    COUNT(poi.id) as item_count,
                    COALESCE(SUM(poi.quantity * poi.expected_unit_price), 0) as expected_total
                  FROM purchase_orders po
                  JOIN suppliers s ON po.supplier_id = s.id
                  LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
                  GROUP BY po.id
                  ORDER BY po.created_at DESC`,
    getById: `SELECT po.*, s.name as supplier_name, s.phone as supplier_phone
                   FROM purchase_orders po
                   JOIN suppliers s ON po.supplier_id = s.id
                   WHERE po.id = ?`,
    getItemsByOrder: `SELECT poi.*, p.name as product_name, p.unit
                            FROM purchase_order_items poi
                            JOIN products p ON poi.product_id = p.id
                            WHERE poi.purchase_order_id = ?`,
    insert: `INSERT INTO purchase_orders (supplier_id, status, order_date, expected_date, notes)
                  VALUES (?, ?, ?, ?, ?)`,
    insertItem: `INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, expected_unit_price)
                      VALUES (?, ?, ?, ?)`,
    updateStatus: `UPDATE purchase_orders SET status = ? WHERE id = ?`,
    // Header/item edits below are only ever called while status='Draft'
    // (enforced in purchaseOrderService, not here) — a PO never touches
    // stock/debt/accounting at any status, so unlike invoice editing there
    // is no cascade to keep in sync, just the record itself.
    update: `UPDATE purchase_orders SET supplier_id = ?, order_date = ?, expected_date = ?, notes = ? WHERE id = ?`,
    updateItem: `UPDATE purchase_order_items SET product_id = ?, quantity = ?, expected_unit_price = ? WHERE id = ?`,
    deleteItem: `DELETE FROM purchase_order_items WHERE id = ?`,
    countItems: `SELECT COUNT(*) as count FROM purchase_order_items WHERE purchase_order_id = ?`
  },

  // ─── WHOLESALE CUSTOMERS ───
  // Balance is never stored — every aggregate below is a correlated
  // subquery (not a JOIN+GROUP BY) specifically to avoid the classic
  // fan-out bug where joining sales_invoices AND customer_payments in
  // the same query multiplies rows and overcounts both sums.
  customers: {
    getAll: `SELECT c.*,
                    COALESCE((SELECT SUM(invoice_amount) FROM sales_invoices WHERE customer_id = c.id), 0) as total_invoice_amount,
                    COALESCE((SELECT COUNT(*) FROM sales_invoices WHERE customer_id = c.id), 0) as total_invoices,
                    COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = c.id), 0) as total_payment_amount,
                    COALESCE((SELECT COUNT(*) FROM customer_payments WHERE customer_id = c.id), 0) as total_payments,
                    (SELECT MAX(invoice_date) FROM sales_invoices WHERE customer_id = c.id) as last_invoice_date,
                    (SELECT MAX(payment_date) FROM customer_payments WHERE customer_id = c.id) as last_payment_date,
                    (COALESCE((SELECT SUM(invoice_amount) FROM sales_invoices WHERE customer_id = c.id), 0)
                     - COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = c.id), 0)) as current_balance
                  FROM customers c
                  ORDER BY c.full_name`,
    search: `SELECT c.*,
                    COALESCE((SELECT SUM(invoice_amount) FROM sales_invoices WHERE customer_id = c.id), 0) as total_invoice_amount,
                    COALESCE((SELECT COUNT(*) FROM sales_invoices WHERE customer_id = c.id), 0) as total_invoices,
                    COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = c.id), 0) as total_payment_amount,
                    COALESCE((SELECT COUNT(*) FROM customer_payments WHERE customer_id = c.id), 0) as total_payments,
                    (SELECT MAX(invoice_date) FROM sales_invoices WHERE customer_id = c.id) as last_invoice_date,
                    (SELECT MAX(payment_date) FROM customer_payments WHERE customer_id = c.id) as last_payment_date,
                    (COALESCE((SELECT SUM(invoice_amount) FROM sales_invoices WHERE customer_id = c.id), 0)
                     - COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = c.id), 0)) as current_balance
                  FROM customers c
                  WHERE c.full_name LIKE ?
                  ORDER BY c.full_name
                  LIMIT 20`,
    getById: `SELECT * FROM customers WHERE id = ?`,
    getSummary: `SELECT c.*,
                    COALESCE((SELECT SUM(invoice_amount) FROM sales_invoices WHERE customer_id = c.id), 0) as total_invoice_amount,
                    COALESCE((SELECT COUNT(*) FROM sales_invoices WHERE customer_id = c.id), 0) as total_invoices,
                    COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = c.id), 0) as total_payment_amount,
                    COALESCE((SELECT COUNT(*) FROM customer_payments WHERE customer_id = c.id), 0) as total_payments,
                    (SELECT MAX(invoice_date) FROM sales_invoices WHERE customer_id = c.id) as last_invoice_date,
                    (SELECT MAX(payment_date) FROM customer_payments WHERE customer_id = c.id) as last_payment_date,
                    (COALESCE((SELECT SUM(invoice_amount) FROM sales_invoices WHERE customer_id = c.id), 0)
                     - COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = c.id), 0)) as current_balance
                  FROM customers c
                  WHERE c.id = ?`,
    insert: `INSERT INTO customers (full_name, phone, address, notes) VALUES (?, ?, ?, ?)`,
    reports: {
      getSummary: `SELECT
                    (SELECT COUNT(*) FROM customers) as total_customers,
                    (SELECT COALESCE(SUM(invoice_amount), 0) FROM sales_invoices) as total_invoice_value,
                    (SELECT COALESCE(SUM(amount), 0) FROM customer_payments) as total_payment_value,
                    ((SELECT COALESCE(SUM(invoice_amount), 0) FROM sales_invoices)
                     - (SELECT COALESCE(SUM(amount), 0) FROM customer_payments)) as total_customer_debt,
                    (SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE AVG(invoice_amount) END FROM sales_invoices) as average_invoice_value`,
      getLargestDebtors: `SELECT c.id, c.full_name,
                    (COALESCE((SELECT SUM(invoice_amount) FROM sales_invoices WHERE customer_id = c.id), 0)
                     - COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = c.id), 0)) as balance
                  FROM customers c
                  ORDER BY balance DESC
                  LIMIT 10`,
      getMostActive: `SELECT c.id, c.full_name,
                    (COALESCE((SELECT COUNT(*) FROM sales_invoices WHERE customer_id = c.id), 0)
                     + COALESCE((SELECT COUNT(*) FROM customer_payments WHERE customer_id = c.id), 0)) as activity_count
                  FROM customers c
                  ORDER BY activity_count DESC
                  LIMIT 10`
    }
  },

  // ─── SALES INVOICES (wholesale customers) ───
  salesInvoices: {
    getByCustomer: `SELECT * FROM sales_invoices WHERE customer_id = ? ORDER BY invoice_date DESC, id DESC`,
    getById: `SELECT si.*, c.full_name as customer_name, c.phone as customer_phone
                   FROM sales_invoices si
                   JOIN customers c ON si.customer_id = c.id
                   WHERE si.id = ? AND si.customer_id = ?`,
    getItemsByInvoice: `SELECT * FROM sales_invoice_items WHERE invoice_id = ?`,
    insert: `INSERT INTO sales_invoices
                    (invoice_number, customer_id, invoice_date, invoice_amount, previous_balance, new_balance, notes)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`,
    updateInvoiceNumber: `UPDATE sales_invoices SET invoice_number = ? WHERE id = ?`,
    insertItem: `INSERT INTO sales_invoice_items
                        (invoice_id, product_name, unit, quantity, unit_price, line_total)
                      VALUES (?, ?, ?, ?, ?, ?)`,
    getCustomerBalance: `SELECT
                    (COALESCE((SELECT SUM(invoice_amount) FROM sales_invoices WHERE customer_id = ?), 0)
                     - COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = ?), 0)) as balance`,
    // UNION ALL of both ledger sources + a running-total window function —
    // nothing here is stored, the whole statement is regenerated on read.
    getStatement: `SELECT entry_type, entry_id, entry_date, reference, amount,
                    SUM(amount) OVER (
                      ORDER BY entry_date, entry_created_at, entry_type, entry_id
                      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                    ) as balance
                  FROM (
                    SELECT 'invoice' as entry_type, id as entry_id, invoice_date as entry_date, created_at as entry_created_at,
                           invoice_number as reference, invoice_amount as amount
                    FROM sales_invoices WHERE customer_id = ?
                    UNION ALL
                    SELECT 'payment' as entry_type, id as entry_id, payment_date as entry_date, created_at as entry_created_at,
                           payment_method as reference, -amount as amount
                    FROM customer_payments WHERE customer_id = ?
                  )
                  ORDER BY entry_date, entry_created_at, entry_type, entry_id`
  },

  // ─── CUSTOMER PAYMENTS ───
  // Deliberately never tied to an invoice_id — payments reduce the
  // account balance as a whole, never a specific invoice.
  customerPayments: {
    getByCustomer: `SELECT * FROM customer_payments WHERE customer_id = ? ORDER BY payment_date DESC, id DESC`,
    insert: `INSERT INTO customer_payments (customer_id, payment_date, amount, payment_method, notes)
                  VALUES (?, ?, ?, ?, ?)`
  },

  // ─── EXPIRATION TRACKING ───
  // Fully independent module — the only join anywhere here is to products,
  // for display (name/barcode/category/unit fallback). No supplier/invoice/
  // stock table is ever referenced. See business-rules.md.
  //
  // `computed_status`/`days_remaining` are never trusted from the stored
  // `status` column except for the two terminal, user-set values
  // (DISCARDED/SOLD) — everything else is recomputed live from
  // expiration_date on every read, same principle as products.current_stock
  // (see database.md).
  expirationBatches: {
    getAll: `SELECT sub.* FROM (
                    SELECT eb.*,
                           p.name as product_name, p.barcode as product_barcode, p.category as product_category,
                           p.unit as product_unit,
                           CAST(julianday(eb.expiration_date) - julianday('now') AS INTEGER) as days_remaining,
                           CASE
                             WHEN eb.status IN ('DISCARDED', 'SOLD') THEN eb.status
                             WHEN CAST(julianday(eb.expiration_date) - julianday('now') AS INTEGER) < 0 THEN 'EXPIRED'
                             WHEN CAST(julianday(eb.expiration_date) - julianday('now') AS INTEGER) <= 30 THEN 'NEAR_EXPIRY'
                             ELSE 'ACTIVE'
                           END as computed_status
                    FROM expiration_batches eb
                    JOIN products p ON eb.product_id = p.id
                  ) sub
                  WHERE (? IS NULL OR sub.product_id = ?)
                    AND (? IS NULL OR sub.product_category = ?)
                    AND (? IS NULL OR sub.computed_status = ?)
                    AND (? IS NULL OR sub.days_remaining <= ?)
                    AND (? IS NULL OR sub.product_name LIKE '%' || ? || '%'
                                    OR sub.product_barcode LIKE '%' || ? || '%'
                                    OR sub.batch_number LIKE '%' || ? || '%')
                  ORDER BY sub.expiration_date ASC`,
    getById: `SELECT eb.*,
                    p.name as product_name, p.barcode as product_barcode, p.category as product_category,
                    p.unit as product_unit,
                    CAST(julianday(eb.expiration_date) - julianday('now') AS INTEGER) as days_remaining,
                    CASE
                      WHEN eb.status IN ('DISCARDED', 'SOLD') THEN eb.status
                      WHEN CAST(julianday(eb.expiration_date) - julianday('now') AS INTEGER) < 0 THEN 'EXPIRED'
                      WHEN CAST(julianday(eb.expiration_date) - julianday('now') AS INTEGER) <= 30 THEN 'NEAR_EXPIRY'
                      ELSE 'ACTIVE'
                    END as computed_status
                  FROM expiration_batches eb
                  JOIN products p ON eb.product_id = p.id
                  WHERE eb.id = ?`,
    insert: `INSERT INTO expiration_batches
                    (product_id, batch_number, manufacturing_date, expiration_date, quantity, unit, location, notes)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    // No product_id here — a batch's product is immutable after creation.
    update: `UPDATE expiration_batches
                  SET batch_number = ?, manufacturing_date = ?, expiration_date = ?,
                      quantity = ?, unit = ?, location = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?`,
    updateStatus: `UPDATE expiration_batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    delete: `DELETE FROM expiration_batches WHERE id = ?`,
    // One aggregate pass over the same computed_status/days_remaining logic.
    getDashboardSummary: `SELECT
                    COUNT(*) FILTER (WHERE computed_status IN ('ACTIVE', 'NEAR_EXPIRY')) as active_count,
                    COUNT(*) FILTER (WHERE computed_status = 'NEAR_EXPIRY') as near_expiry_count,
                    COUNT(*) FILTER (WHERE computed_status = 'EXPIRED') as expired_count,
                    COUNT(*) FILTER (WHERE computed_status = 'DISCARDED') as discarded_count,
                    COUNT(*) FILTER (WHERE computed_status NOT IN ('DISCARDED', 'SOLD') AND days_remaining = 0) as expiring_today_count,
                    COUNT(*) FILTER (WHERE computed_status NOT IN ('DISCARDED', 'SOLD') AND days_remaining BETWEEN 0 AND 7) as expiring_this_week_count,
                    COUNT(*) FILTER (WHERE computed_status NOT IN ('DISCARDED', 'SOLD') AND days_remaining BETWEEN 0 AND 30) as expiring_this_month_count
                  FROM (
                    SELECT eb.status,
                           CAST(julianday(eb.expiration_date) - julianday('now') AS INTEGER) as days_remaining,
                           CASE
                             WHEN eb.status IN ('DISCARDED', 'SOLD') THEN eb.status
                             WHEN CAST(julianday(eb.expiration_date) - julianday('now') AS INTEGER) < 0 THEN 'EXPIRED'
                             WHEN CAST(julianday(eb.expiration_date) - julianday('now') AS INTEGER) <= 30 THEN 'NEAR_EXPIRY'
                             ELSE 'ACTIVE'
                           END as computed_status
                    FROM expiration_batches eb
                  )`
  },

  // ─── SETTINGS ───
  // Single-row table (id always 1) — see database.md.
  businessProfile: {
    get: `SELECT * FROM business_profile WHERE id = 1`,
    update: `UPDATE business_profile
                 SET business_name = ?, address = ?, phone = ?, email = ?,
                     tax_number = ?, commercial_register = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = 1`,
    updateLogo: `UPDATE business_profile SET logo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`
  }
};

module.exports = QUERIES;