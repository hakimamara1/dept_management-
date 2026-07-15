// services/customerService.js
const db = require('../config/database');

/**
 * Wholesale Customer Service — completely independent from inventory,
 * accounting, and the supplier domain.
 *
 * RULE: customers never carry a stored balance column. Every balance is
 * computed as SUM(sales_invoices.invoice_amount) - SUM(customer_payments.amount)
 * (see models/queries.js — all the aggregate queries here are correlated
 * subqueries, not JOINs, specifically to avoid fan-out double-counting).
 *
 * RULE: payments are never linked to a specific invoice. They only ever
 * reduce the customer's overall account balance.
 */
class CustomerService {
    getAll(query) {
        if (query) {
            return db.stmts.customers.search.all(`%${query}%`);
        }
        return db.stmts.customers.getAll.all();
    }

    getById(id) {
        return db.stmts.customers.getSummary.get(id);
    }

    create({ fullName, phone, address, notes }) {
        if (!fullName || !fullName.trim()) {
            throw new Error('اسم العميل مطلوب');
        }

        const result = db.stmts.customers.insert.run(
            fullName.trim(),
            phone || null,
            address || null,
            notes || null
        );

        return this.getById(result.lastInsertRowid);
    }

    getCurrentBalance(customerId) {
        const row = db.stmts.salesInvoices.getCustomerBalance.get(customerId, customerId);
        return Number(row.balance || 0);
    }

    getInvoicesByCustomer(customerId) {
        return db.stmts.salesInvoices.getByCustomer.all(customerId);
    }

    getInvoice(customerId, invoiceId) {
        const invoice = db.stmts.salesInvoices.getById.get(invoiceId, customerId);
        if (!invoice) return null;

        const items = db.stmts.salesInvoices.getItemsByInvoice.all(invoiceId);
        return { ...invoice, items };
    }

    createInvoice(customerId, { invoiceDate, items, notes }) {
        if (!invoiceDate) {
            throw new Error('تاريخ الفاتورة مطلوب');
        }
        if (!items || !items.length) {
            throw new Error('يجب أن تحتوي الفاتورة على صنف واحد على الأقل');
        }

        const customer = db.stmts.customers.getById.get(customerId);
        if (!customer) {
            throw new Error('العميل غير موجود');
        }

        const transaction = db.transaction(() => {
            const lineItems = items.map((item) => {
                if (!item.productName || !item.productName.trim()) {
                    throw new Error('اسم الصنف مطلوب لكل سطر');
                }
                if (!item.quantity || item.quantity <= 0) {
                    throw new Error('الكمية يجب أن تكون أكبر من الصفر');
                }
                if (item.unitPrice == null || item.unitPrice < 0) {
                    throw new Error('سعر الوحدة غير صالح');
                }
                const lineTotal = Number(item.quantity) * Number(item.unitPrice);
                return { ...item, lineTotal };
            });

            const invoiceAmount = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
            const previousBalance = this.getCurrentBalance(customerId);
            const newBalance = previousBalance + invoiceAmount;

            // Insert with a temporary, guaranteed-unique placeholder — the
            // final human-readable number needs the row id, which SQLite
            // only hands back after the insert.
            const tempNumber = `TEMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const result = db.stmts.salesInvoices.insert.run(
                tempNumber,
                customerId,
                invoiceDate,
                invoiceAmount,
                previousBalance,
                newBalance,
                notes || null
            );

            const invoiceId = result.lastInsertRowid;
            const invoiceNumber = `SINV-${String(invoiceId).padStart(6, '0')}`;
            db.stmts.salesInvoices.updateInvoiceNumber.run(invoiceNumber, invoiceId);

            for (const item of lineItems) {
                db.stmts.salesInvoices.insertItem.run(
                    invoiceId,
                    item.productName.trim(),
                    item.unit || null,
                    item.quantity,
                    item.unitPrice,
                    item.lineTotal
                );
            }

            return this.getInvoice(customerId, invoiceId);
        });

        return transaction();
    }

    getPaymentsByCustomer(customerId) {
        return db.stmts.customerPayments.getByCustomer.all(customerId);
    }

    recordPayment(customerId, { paymentDate, amount, paymentMethod, notes }) {
        const customer = db.stmts.customers.getById.get(customerId);
        if (!customer) {
            throw new Error('العميل غير موجود');
        }
        if (!paymentDate) {
            throw new Error('تاريخ الدفعة مطلوب');
        }
        if (!amount || amount <= 0) {
            throw new Error('مبلغ الدفعة يجب أن يكون أكبر من الصفر');
        }

        const result = db.stmts.customerPayments.insert.run(
            customerId,
            paymentDate,
            amount,
            paymentMethod || null,
            notes || null
        );

        return db.stmts.customerPayments.getByCustomer
            .all(customerId)
            .find((p) => p.id === result.lastInsertRowid);
    }

    getStatement(customerId) {
        return db.stmts.salesInvoices.getStatement.all(customerId, customerId);
    }

    getReportsSummary() {
        const summary = db.stmts.customers.reports.getSummary.get();
        const largestDebtors = db.stmts.customers.reports.getLargestDebtors.all();
        const mostActive = db.stmts.customers.reports.getMostActive.all();
        return { ...summary, largestDebtors, mostActive };
    }
}

module.exports = new CustomerService();
