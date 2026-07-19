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

    // ═══════════════════════════════════════════════════════════════
    // EDITING — only ever allowed while status === 'Draft'. Unlike an
    // invoice, a PO never posts to stock/debt/accounting at any status
    // (see class docblock), so there's no cascade to keep in sync here —
    // editing is just correcting the record itself.
    // ═══════════════════════════════════════════════════════════════
    _requireDraft(id) {
        const order = db.stmts.purchaseOrders.getById.get(id);
        if (!order) {
            throw new Error('أمر الشراء غير موجود');
        }
        if (order.status !== 'Draft') {
            throw new Error('لا يمكن التعديل — أمر الشراء ليس في حالة مسودة');
        }
        return order;
    }

    updateOrder(id, { supplierId, orderDate, expectedDate, notes }) {
        const order = this._requireDraft(id);
        db.stmts.purchaseOrders.update.run(
            supplierId ?? order.supplier_id,
            orderDate ?? order.order_date,
            expectedDate !== undefined ? (expectedDate || null) : order.expected_date,
            notes !== undefined ? (notes || null) : order.notes,
            id
        );
        return this.getById(id);
    }

    updateOrderItem(orderId, itemId, { productId, quantity, expectedUnitPrice }) {
        this._requireDraft(orderId);
        const item = db.prepare('SELECT * FROM purchase_order_items WHERE id = ? AND purchase_order_id = ?').get(itemId, orderId);
        if (!item) {
            throw new Error('الصنف غير موجود في هذا الأمر');
        }
        const newQty = quantity != null ? Number(quantity) : Number(item.quantity);
        if (!newQty || newQty <= 0) {
            throw new Error('الكمية يجب أن تكون أكبر من الصفر');
        }
        db.stmts.purchaseOrders.updateItem.run(
            productId ?? item.product_id,
            newQty,
            expectedUnitPrice !== undefined ? expectedUnitPrice : item.expected_unit_price,
            itemId
        );
        return this.getById(orderId);
    }

    addOrderItem(orderId, { productId, quantity, expectedUnitPrice }) {
        this._requireDraft(orderId);
        if (!productId) {
            throw new Error('اختر منتجاً');
        }
        const qty = Number(quantity);
        if (!qty || qty <= 0) {
            throw new Error('الكمية يجب أن تكون أكبر من الصفر');
        }
        db.stmts.purchaseOrders.insertItem.run(orderId, productId, qty, expectedUnitPrice ?? null);
        return this.getById(orderId);
    }

    deleteOrderItem(orderId, itemId) {
        this._requireDraft(orderId);
        const item = db.prepare('SELECT * FROM purchase_order_items WHERE id = ? AND purchase_order_id = ?').get(itemId, orderId);
        if (!item) {
            throw new Error('الصنف غير موجود في هذا الأمر');
        }
        const { count } = db.stmts.purchaseOrders.countItems.get(orderId);
        if (count <= 1) {
            throw new Error('لا يمكن حذف آخر صنف في أمر الشراء');
        }
        db.stmts.purchaseOrders.deleteItem.run(itemId);
        return this.getById(orderId);
    }
}

module.exports = new PurchaseOrderService();
