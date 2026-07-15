// services/purchaseOrderService.js
const db = require('../config/database');

const VALID_STATUSES = ['Draft', 'Sent', 'Received', 'Cancelled'];
const TERMINAL_STATUSES = ['Received', 'Cancelled'];

/**
 * Purchase Order Service — a lightweight tracking/intent record.
 * Deliberately does NOT touch stock, debt, or accounting: those only
 * happen when the real invoice arrives through the OCR pipeline
 * (see invoiceProcessor.js). A PO is what you intend to buy, not a
 * financial transaction.
 */
class PurchaseOrderService {
    getAll() {
        return db.stmts.purchaseOrders.getAll.all();
    }

    getById(id) {
        const order = db.stmts.purchaseOrders.getById.get(id);
        if (!order) return null;

        const items = db.stmts.purchaseOrders.getItemsByOrder.all(id);
        return { ...order, items };
    }

    create({ supplierId, orderDate, expectedDate, notes, items }) {
        if (!items || !items.length) {
            throw new Error('أمر الشراء يجب أن يحتوي على صنف واحد على الأقل');
        }

        const transaction = db.transaction(() => {
            const result = db.stmts.purchaseOrders.insert.run(
                supplierId,
                'Draft',
                orderDate,
                expectedDate || null,
                notes || null
            );
            const orderId = result.lastInsertRowid;

            for (const item of items) {
                db.stmts.purchaseOrders.insertItem.run(
                    orderId,
                    item.productId,
                    item.quantity,
                    item.expectedUnitPrice ?? null
                );
            }

            return this.getById(orderId);
        });

        return transaction();
    }

    updateStatus(id, status) {
        if (!VALID_STATUSES.includes(status)) {
            throw new Error(`حالة غير صالحة: ${status}`);
        }

        const order = db.stmts.purchaseOrders.getById.get(id);
        if (!order) {
            throw new Error('أمر الشراء غير موجود');
        }
        if (TERMINAL_STATUSES.includes(order.status)) {
            throw new Error(`لا يمكن تعديل أمر شراء بحالة "${order.status}"`);
        }

        db.stmts.purchaseOrders.updateStatus.run(status, id);
        return this.getById(id);
    }
}

module.exports = new PurchaseOrderService();
