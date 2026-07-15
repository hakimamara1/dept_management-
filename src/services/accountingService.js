// services/accountingService.js
const db = require('../config/database');

/**
 * Accounting Service — Double-entry bookkeeping.
 * Every invoice creates at least 2 entries (debit + credit).
 * Sum of all debits must equal sum of all credits.
 */

const ACCOUNTS = {
    INVENTORY: 'inventory',           // Asset: products we own
    ACCOUNTS_PAYABLE: 'accounts_payable', // Liability: money we owe suppliers
    PURCHASES: 'purchases',             // Expense: cost of goods purchased
    CASH: 'cash',                       // Asset: cash on hand
    BANK: 'bank',                      // Asset: bank balance
    SALES: 'sales',                    // Revenue: income from sales
    COST_OF_GOODS_SOLD: 'cogs',        // Expense: cost of sold inventory
    DISCOUNT_RECEIVED: 'discount_received', // Income: supplier discounts
    TAX: 'tax_payable'                 // Liability: VAT/tax owed
};

class AccountingService {
    /**
     * Record a purchase invoice in accounting books.
     * Double entry:
     *   Dr. Inventory (increase asset)
     *   Cr. Accounts Payable (increase liability)
     * 
     * If discount exists:
     *   Dr. Inventory (net amount)
     *   Cr. Accounts Payable (net amount)
     *   (Discount is implicit in the net)
     * 
     * @param {number} invoiceId
     * @param {string} date — YYYY-MM-DD
     * @param {number} amount — gross amount
     * @param {number} [discount] — discount amount
     * @param {number} [tax] — tax amount
     * @param {string} [description]
     */
    recordPurchaseInvoice(invoiceId, date, amount, discount = 0, tax = 0, description = '') {
        const netAmount = amount - discount + tax;
        const entries = [];

        // 1. Debit Inventory (asset increases)
        entries.push({
            invoiceId,
            date,
            account: ACCOUNTS.INVENTORY,
            debit: netAmount,
            credit: 0,
            description: description || 'Purchase inventory'
        });

        // 2. Credit Accounts Payable (liability increases)
        entries.push({
            invoiceId,
            date,
            account: ACCOUNTS.ACCOUNTS_PAYABLE,
            debit: 0,
            credit: netAmount,
            description: description || 'Supplier debt'
        });

        // 3. If discount exists, record it separately (optional detailed tracking)
        if (discount > 0) {
            entries.push({
                invoiceId,
                date,
                account: ACCOUNTS.DISCOUNT_RECEIVED,
                debit: 0,
                credit: discount,
                description: 'Purchase discount received'
            });
            // Adjust inventory debit to be gross amount
            entries[0].debit = amount + tax;  // Gross + tax
            entries[1].credit = amount - discount + tax;  // Net payable
        }

        // 4. If tax exists
        if (tax > 0) {
            entries.push({
                invoiceId,
                date,
                account: ACCOUNTS.TAX,
                debit: 0,
                credit: tax,
                description: 'Input VAT on purchase'
            });
        }

        return this.insertEntries(entries);
    }

    /**
     * Record a supplier payment.
     * Double entry:
     *   Dr. Accounts Payable (decrease liability)
     *   Cr. Cash/Bank (decrease asset)
     * 
     * @param {number} invoiceId — optional, can be null for bulk payment
     * @param {string} date
     * @param {number} amount
     * @param {string} paymentMethod — 'cash' or 'bank'
     * @param {string} [description]
     */
    recordPayment(invoiceId, date, amount, paymentMethod = 'cash', description = '') {
        const creditAccount = paymentMethod === 'bank' ? ACCOUNTS.BANK : ACCOUNTS.CASH;

        const entries = [
            {
                invoiceId,
                date,
                account: ACCOUNTS.ACCOUNTS_PAYABLE,
                debit: amount,
                credit: 0,
                description: description || `Payment to supplier`
            },
            {
                invoiceId,
                date,
                account: creditAccount,
                debit: 0,
                credit: amount,
                description: description || `Payment from ${paymentMethod}`
            }
        ];

        return this.insertEntries(entries);
    }

    /**
     * Record a sale (when you build sales later).
     * Double entry:
     *   Dr. Cash/Bank (asset increases)
     *   Cr. Sales (revenue increases)
     * 
     * And:
     *   Dr. Cost of Goods Sold (expense)
     *   Cr. Inventory (asset decreases)
     * 
     * @param {number} invoiceId
     * @param {string} date
     * @param {number} saleAmount
     * @param {number} cogs — cost of goods sold
     * @param {string} paymentMethod
     */
    recordSale(invoiceId, date, saleAmount, cogs, paymentMethod = 'cash') {
        const debitAccount = paymentMethod === 'bank' ? ACCOUNTS.BANK : ACCOUNTS.CASH;

        const entries = [
            // Revenue side
            {
                invoiceId, date, account: debitAccount,
                debit: saleAmount, credit: 0,
                description: 'Cash/Bank from sale'
            },
            {
                invoiceId, date, account: ACCOUNTS.SALES,
                debit: 0, credit: saleAmount,
                description: 'Sales revenue'
            },
            // Cost side
            {
                invoiceId, date, account: ACCOUNTS.COST_OF_GOODS_SOLD,
                debit: cogs, credit: 0,
                description: 'Cost of goods sold'
            },
            {
                invoiceId, date, account: ACCOUNTS.INVENTORY,
                debit: 0, credit: cogs,
                description: 'Inventory reduction from sale'
            }
        ];

        return this.insertEntries(entries);
    }

    /**
     * Insert multiple accounting entries atomically.
     * Should be called inside a transaction.
     * @param {Array} entries
     */
    insertEntries(entries) {
        const ids = [];
        for (const entry of entries) {
            const result = db.stmts.accounting.insert.run(
                entry.invoiceId,
                entry.date,
                entry.account,
                entry.debit,
                entry.credit,
                entry.description
            );
            ids.push(result.lastInsertRowid);
        }

        // Verify double-entry balance
        const totalDebits = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
        const totalCredits = entries.reduce((sum, e) => sum + (e.credit || 0), 0);

        if (Math.abs(totalDebits - totalCredits) > 0.01) {
            throw new Error(
                `Double-entry imbalance: Debits=${totalDebits}, Credits=${totalCredits}`
            );
        }

        return { entryIds: ids, totalDebits, totalCredits };
    }

    /**
     * Get trial balance — sum of all debits and credits per account.
     * In a balanced system, total debits = total credits.
     */
    getTrialBalance() {
        return db.stmts.accounting.getTrialBalance.all();
    }

    /**
     * Verify that the entire accounting system is balanced.
     * @returns {{balanced: boolean, difference: number}}
     */
    verifyBalance() {
        const result = db.prepare(
            `SELECT 
                COALESCE(SUM(debit), 0) as total_debits,
                COALESCE(SUM(credit), 0) as total_credits
             FROM accounting_transactions`
        ).get();

        const difference = Math.abs(Number(result.total_debits) - Number(result.total_credits));
        return {
            balanced: difference < 0.01,
            difference,
            totalDebits: Number(result.total_debits),
            totalCredits: Number(result.total_credits)
        };
    }

    /**
     * Get journal entries for a specific invoice.
     * @param {number} invoiceId
     */
    getJournalEntry(invoiceId) {
        return db.stmts.accounting.getJournalEntry.all(invoiceId);
    }

    /**
     * Get entries for a specific account.
     * @param {string} accountCode
     */
    getAccountLedger(accountCode) {
        return db.stmts.accounting.getByAccount.all(accountCode);
    }

    /**
     * Get entries within a date range.
     * @param {string} startDate — YYYY-MM-DD
     * @param {string} endDate — YYYY-MM-DD
     */
    getEntriesByDate(startDate, endDate) {
        return db.stmts.accounting.getByDateRange.all(startDate, endDate);
    }

    /**
     * Get balance for a specific account.
     * @param {string} accountCode
     * @returns {number} Debit - Credit
     */
    getAccountBalance(accountCode) {
        const result = db.prepare(
            `SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) as balance
             FROM accounting_transactions WHERE account_code = ?`
        ).get(accountCode);
        return Number(result.balance);
    }

    /**
     * Get balance sheet summary.
     * Assets, Liabilities snapshot.
     */
    getBalanceSheet() {
        const assets = ['inventory', 'cash', 'bank'];
        const liabilities = ['accounts_payable', 'tax_payable'];
        const equity = [];  // Add later if needed

        const getSum = (codes) => {
            const placeholders = codes.map(() => '?').join(',');
            const result = db.prepare(
                `SELECT COALESCE(SUM(debit) - SUM(credit), 0) as balance
                 FROM accounting_transactions WHERE account_code IN (${placeholders})`
            ).get(...codes);
            return Number(result.balance);
        };

        return {
            assets: getSum(assets),
            liabilities: getSum(liabilities),
            equity: getSum(equity),
            netWorth: getSum(assets) - getSum(liabilities)
        };
    }

    /**
     * Get profit/loss summary (requires sales module).
     */
    getProfitLoss(startDate, endDate) {
        const revenue = this.getAccountBalance(ACCOUNTS.SALES);
        const cogs = this.getAccountBalance(ACCOUNTS.COST_OF_GOODS_SOLD);
        const purchases = this.getAccountBalance(ACCOUNTS.PURCHASES);

        return {
            revenue,
            cogs,
            purchases,
            grossProfit: revenue - cogs,
            netPurchases: purchases  // Until sales module is built
        };
    }
}

module.exports = { AccountingService: new AccountingService(), ACCOUNTS };