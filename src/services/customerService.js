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

    // Always created as a Draft — has zero effect on the customer's balance
    // or statement until explicitly approved (see approveInvoice below).
    // previous_balance/new_balance are stamped here as a live preview only;
    // they get overwritten for real at approval time.
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
                notes || null,
                'Draft'
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

    // ═══════════════════════════════════════════════════════════════
    // DRAFT EDITING — the only place item corrections happen. Every method
    // here throws if the invoice isn't still a Draft; once Final (approved),
    // none of this is reachable, by design (mirrors invoiceProcessor's
    // Pending-Review-only item editing on the purchase side).
    // ═══════════════════════════════════════════════════════════════
    _requireDraftInvoice(customerId, invoiceId) {
        const invoice = db.stmts.salesInvoices.getById.get(invoiceId, customerId);
        if (!invoice) {
            throw new Error('الفاتورة غير موجودة');
        }
        if (invoice.status !== 'Draft') {
            throw new Error('لا يمكن التعديل — الفاتورة معتمدة بالفعل');
        }
        return invoice;
    }

    // Recomputes previous_balance/new_balance as a fresh live preview after
    // an item change — the draft itself is excluded from getCurrentBalance,
    // so this always reflects "what the balance would become if approved
    // right now."
    _refreshDraftPreview(customerId, invoiceId) {
        const invoice = db.stmts.salesInvoices.getById.get(invoiceId, customerId);
        const previousBalance = this.getCurrentBalance(customerId);
        const newBalance = previousBalance + Number(invoice.invoice_amount);
        db.prepare('UPDATE sales_invoices SET previous_balance = ?, new_balance = ? WHERE id = ?')
            .run(previousBalance, newBalance, invoiceId);
    }

    updateInvoiceItem(customerId, invoiceId, itemId, { productName, unit, quantity, unitPrice }) {
        const transaction = db.transaction(() => {
            this._requireDraftInvoice(customerId, invoiceId);
            const item = db.prepare('SELECT * FROM sales_invoice_items WHERE id = ? AND invoice_id = ?').get(itemId, invoiceId);
            if (!item) {
                throw new Error('الصنف غير موجود في هذه الفاتورة');
            }

            const newName = productName && productName.toString().trim() ? productName.toString().trim() : item.product_name;
            const newUnit = unit !== undefined ? (unit || null) : item.unit;
            const newQty = quantity != null ? Number(quantity) : Number(item.quantity);
            const newPrice = unitPrice != null ? Number(unitPrice) : Number(item.unit_price);
            if (!newQty || newQty <= 0) throw new Error('الكمية يجب أن تكون أكبر من الصفر');
            if (newPrice < 0) throw new Error('سعر الوحدة غير صالح');
            const newTotal = newQty * newPrice;

            db.stmts.salesInvoices.updateItem.run(newName, newUnit, newQty, newPrice, newTotal, itemId);
            db.stmts.salesInvoices.recalculateTotal.run(invoiceId, invoiceId);
            this._refreshDraftPreview(customerId, invoiceId);

            return this.getInvoice(customerId, invoiceId);
        });

        return transaction();
    }

    addInvoiceItem(customerId, invoiceId, { productName, unit, quantity, unitPrice }) {
        const transaction = db.transaction(() => {
            this._requireDraftInvoice(customerId, invoiceId);
            if (!productName || !productName.toString().trim()) throw new Error('اسم الصنف مطلوب');
            const qty = Number(quantity);
            const price = Number(unitPrice);
            if (!qty || qty <= 0) throw new Error('الكمية يجب أن تكون أكبر من الصفر');
            if (price == null || price < 0 || Number.isNaN(price)) throw new Error('سعر الوحدة غير صالح');

            db.stmts.salesInvoices.insertItem.run(invoiceId, productName.toString().trim(), unit || null, qty, price, qty * price);
            db.stmts.salesInvoices.recalculateTotal.run(invoiceId, invoiceId);
            this._refreshDraftPreview(customerId, invoiceId);

            return this.getInvoice(customerId, invoiceId);
        });

        return transaction();
    }

    deleteInvoiceItem(customerId, invoiceId, itemId) {
        const transaction = db.transaction(() => {
            this._requireDraftInvoice(customerId, invoiceId);
            const item = db.prepare('SELECT * FROM sales_invoice_items WHERE id = ? AND invoice_id = ?').get(itemId, invoiceId);
            if (!item) {
                throw new Error('الصنف غير موجود في هذه الفاتورة');
            }
            const { count } = db.stmts.salesInvoices.countItems.get(invoiceId);
            if (count <= 1) {
                throw new Error('يجب أن تحتوي الفاتورة على صنف واحد على الأقل');
            }

            db.stmts.salesInvoices.deleteItem.run(itemId);
            db.stmts.salesInvoices.recalculateTotal.run(invoiceId, invoiceId);
            this._refreshDraftPreview(customerId, invoiceId);

            return this.getInvoice(customerId, invoiceId);
        });

        return transaction();
    }

    updateInvoiceNotes(customerId, invoiceId, notes) {
        this._requireDraftInvoice(customerId, invoiceId);
        db.stmts.salesInvoices.updateNotes.run(notes || null, invoiceId);
        return this.getInvoice(customerId, invoiceId);
    }

    deleteInvoice(customerId, invoiceId) {
        const transaction = db.transaction(() => {
            this._requireDraftInvoice(customerId, invoiceId);
            db.stmts.salesInvoices.deleteItemsByInvoice.run(invoiceId);
            db.stmts.salesInvoices.deleteInvoice.run(invoiceId);
            return { success: true };
        });

        return transaction();
    }

    // Locks the draft in for real: the live balance *at this moment*
    // becomes previous_balance (correctly excludes this row — it's still
    // Draft at read time), status flips to Final, and only from here on
    // does this invoice affect getCustomerBalance/getStatement.
    approveInvoice(customerId, invoiceId) {
        const transaction = db.transaction(() => {
            const invoice = this._requireDraftInvoice(customerId, invoiceId);
            const previousBalance = this.getCurrentBalance(customerId);
            const newBalance = previousBalance + Number(invoice.invoice_amount);
            db.stmts.salesInvoices.approve.run(previousBalance, newBalance, invoiceId);
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

    // Manual correction for a wrong balance (data-entry mistakes, agreed
    // write-offs) — mirrors debtService.adjustBalance on the supplier side.
    // Positive amount increases what the customer owes, negative decreases
    // it. Stored as a 'adjustment'-typed customer_payments row rather than a
    // stored balance column, since customers never have one (see class
    // docblock) — getCustomerBalance/getStatement both know how to fold
    // this row type in with the opposite sign of a real payment.
    adjustBalance(customerId, amount, reason) {
        const customer = db.stmts.customers.getById.get(customerId);
        if (!customer) {
            throw new Error('العميل غير موجود');
        }
        const sanitizedAmount = Number(amount);
        if (!sanitizedAmount) {
            throw new Error('قيمة التسوية يجب أن تكون مختلفة عن الصفر');
        }
        if (!reason || !reason.trim()) {
            throw new Error('سبب التسوية مطلوب');
        }

        const previousBalance = this.getCurrentBalance(customerId);
        const today = new Date().toISOString().slice(0, 10);
        const result = db.stmts.customerPayments.insertAdjustment.run(
            customerId,
            today,
            sanitizedAmount,
            reason.trim()
        );

        return {
            transactionId: result.lastInsertRowid,
            previousBalance,
            adjustment: sanitizedAmount,
            newBalance: previousBalance + sanitizedAmount
        };
    }

    getReportsSummary() {
        const summary = db.stmts.customers.reports.getSummary.get();
        const largestDebtors = db.stmts.customers.reports.getLargestDebtors.all();
        const mostActive = db.stmts.customers.reports.getMostActive.all();
        return { ...summary, largestDebtors, mostActive };
    }
}

module.exports = new CustomerService();
