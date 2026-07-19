// services/debtService.js
const db = require('../config/database');
const { parseNumber } = require('../utils/parseNumber');

/**
 * Debt Service — Supplier debt/accounts payable management.
 * Uses ledger-style entries: every transaction appends a row.
 * Current balance = last entry's balance_after.
 */

class DebtService {
    /**
     * Get current balance for a supplier.
     * @param {number} supplierId
     * @returns {number} Current balance in DZD
     */
    // Guarded with parseNumber, not a raw Number(...) cast — current_balance
    // is a maintained snapshot column, and a bad write from anywhere (a
    // string with a thousands separator, corrupted legacy data, etc.) must
    // never propagate as NaN into every future balance update. See
    // ADR-017: this is exactly the failure mode that corrupted a real
    // supplier's balance to the literal text "NaN99,220.00".
    getCurrentBalance(supplierId) {
        const supplier = db.prepare('SELECT current_balance FROM suppliers WHERE id = ?').get(supplierId);
        return supplier ? parseNumber(supplier.current_balance) : 0;
    }

    /**
     * Record an invoice — increases debt.
     * @param {number} supplierId
     * @param {number} invoiceId
     * @param {number} amount — invoice amount in DZD
     * @param {string} [description]
     * @returns {{transactionId: number, newBalance: number}}
     */
    addInvoiceDebt(supplierId, invoiceId, amount, description = '') {
        const sanitizedAmount = parseNumber(amount);
        const currentBalance = this.getCurrentBalance(supplierId);
        const newBalance = currentBalance + sanitizedAmount;

        const result = db.stmts.debt.insertTransaction.run(
            supplierId,
            invoiceId,
            'invoice',
            sanitizedAmount,
            newBalance,
            description || `Invoice debt`
        );

        // Update supplier snapshot
        db.stmts.suppliers.updateBalance.run(newBalance, supplierId);

        return {
            transactionId: result.lastInsertRowid,
            previousBalance: currentBalance,
            amount: sanitizedAmount,
            newBalance
        };
    }

    /**
     * Record a payment — decreases debt.
     * @param {number} supplierId
     * @param {number} amount — payment amount (positive number)
     * @param {string} [paymentMethod] — cash, bank_transfer, check
     * @param {string} [reference] — receipt number, check number
     * @param {string} [notes]
     * @returns {{transactionId: number, newBalance: number}}
     */
    recordPayment(supplierId, amount, paymentMethod = 'cash', reference = '', notes = '') {
        const sanitizedAmount = parseNumber(amount);
        if (sanitizedAmount <= 0) {
            throw new Error('Payment amount must be positive');
        }

        const currentBalance = this.getCurrentBalance(supplierId);
        const paymentAmount = -sanitizedAmount;  // Negative = debt reduction
        const newBalance = currentBalance - sanitizedAmount;

        if (newBalance < 0) {
            throw new Error(`Payment exceeds debt. Current balance: ${currentBalance}, Payment: ${sanitizedAmount}`);
        }

        const result = db.stmts.debt.insertTransaction.run(
            supplierId,
            null,  // No invoice linked for pure payment
            'payment',
            paymentAmount,
            newBalance,
            `Payment via ${paymentMethod} ${reference ? '(' + reference + ')' : ''} ${notes}`.trim()
        );

        db.stmts.suppliers.updateBalance.run(newBalance, supplierId);

        return {
            transactionId: result.lastInsertRowid,
            previousBalance: currentBalance,
            paymentAmount: sanitizedAmount,
            newBalance
        };
    }

    /**
     * Record a debt adjustment (e.g., discount, write-off, error correction).
     * @param {number} supplierId
     * @param {number} amount — positive = increase debt, negative = decrease
     * @param {string} reason
     */
    adjustBalance(supplierId, amount, reason) {
        const sanitizedAmount = parseNumber(amount);
        const currentBalance = this.getCurrentBalance(supplierId);
        const newBalance = currentBalance + sanitizedAmount;

        const result = db.stmts.debt.insertTransaction.run(
            supplierId,
            null,
            'adjustment',
            sanitizedAmount,
            newBalance,
            reason
        );

        db.stmts.suppliers.updateBalance.run(newBalance, supplierId);

        return {
            transactionId: result.lastInsertRowid,
            previousBalance: currentBalance,
            adjustment: sanitizedAmount,
            newBalance
        };
    }

    /**
     * Get full transaction history (ledger) for a supplier.
     * @param {number} supplierId
     * @returns {Array} All transactions with invoice details
     */
    getSupplierLedger(supplierId) {
        return db.stmts.debt.getSupplierLedger.all(supplierId);
    }

    /**
     * Get all transactions for a supplier (raw).
     */
    getTransactions(supplierId) {
        return db.stmts.debt.getBySupplier.all(supplierId);
    }

    /**
     * Get debt aging report — how old are the debts?
     * Buckets: 0-30 days, 30-60, 60-90, 90+ days
     */
    getAgingReport() {
        return db.stmts.debt.getAgingReport.all();
    }

    /**
     * Get top debtors (suppliers with highest balance).
     * @param {number} limit
     */
    getTopDebtors(limit = 10) {
        return db.prepare(
            `SELECT name, current_balance FROM suppliers ORDER BY current_balance DESC LIMIT ?`
        ).all(limit);
    }

    /**
     * Get total debt across all suppliers.
     * @returns {number}
     */
    getTotalDebt() {
        const result = db.prepare('SELECT COALESCE(SUM(current_balance), 0) as total FROM suppliers').get();
        return Number(result.total);
    }

    /**
     * Check if supplier has pending invoices (unpaid or partially paid).
     * @param {number} supplierId
     */
    hasPendingInvoices(supplierId) {
        const result = db.prepare(
            `SELECT COUNT(*) as count FROM purchase_invoices
             WHERE supplier_id = ? AND status = 'Approved' AND new_balance > 0`
        ).get(supplierId);
        return result.count > 0;
    }

    /**
     * Get supplier statement (all activity).
     * @param {number} supplierId
     * @param {string} [startDate] — YYYY-MM-DD
     * @param {string} [endDate] — YYYY-MM-DD
     */
    getStatement(supplierId, startDate = null, endDate = null) {
        let query = `SELECT 
                        st.*,
                        pi.invoice_number,
                        pi.invoice_date
                     FROM supplier_transactions st
                     LEFT JOIN purchase_invoices pi ON st.invoice_id = pi.id
                     WHERE st.supplier_id = ?`;
        const params = [supplierId];

        if (startDate) {
            query += ` AND date(st.created_at) >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND date(st.created_at) <= ?`;
            params.push(endDate);
        }

        query += ` ORDER BY st.created_at DESC`;

        return db.prepare(query).all(...params);
    }
}

module.exports = new DebtService();