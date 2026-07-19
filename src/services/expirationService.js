// services/expirationService.js
/**
 * Expiration Tracking — fully independent module. Never touches stock,
 * purchase-invoice approval, or supplier/customer accounting; the only
 * coupling to the rest of the system is product_id (see business-rules.md).
 *
 * Status: ACTIVE/NEAR_EXPIRY/EXPIRED are pure functions of expiration_date
 * vs. today, always recomputed live by the SQL in queries.js — never
 * trusted from the stored `status` column. DISCARDED/SOLD are terminal,
 * user-set values with no date logic of their own.
 */

const db = require('../config/database');

const SETTABLE_STATUSES = ['ACTIVE', 'DISCARDED', 'SOLD'];

class ExpirationService {
    getAll(filters = {}) {
        const productId = filters.productId ?? null;
        const category = filters.category ?? null;
        const status = filters.status ?? null;
        const expiringWithinDays = filters.expiringWithinDays ?? null;
        const search = filters.search ?? null;

        return db.stmts.expirationBatches.getAll.all(
            productId, productId,
            category, category,
            status, status,
            expiringWithinDays, expiringWithinDays,
            search, search, search, search
        );
    }

    getById(id) {
        return db.stmts.expirationBatches.getById.get(id) || null;
    }

    createBatch({ productId, batchNumber, expirationDate, manufacturingDate, quantity, unit, location, notes }) {
        if (!productId) {
            throw new Error('المنتج مطلوب');
        }
        const product = db.stmts.getProductById.get(productId);
        if (!product) {
            throw new Error('المنتج غير موجود');
        }
        if (!batchNumber || !batchNumber.toString().trim()) {
            throw new Error('رقم الدفعة مطلوب');
        }
        if (!expirationDate) {
            throw new Error('تاريخ انتهاء الصلاحية مطلوب');
        }
        if (manufacturingDate && new Date(expirationDate) < new Date(manufacturingDate)) {
            throw new Error('تاريخ انتهاء الصلاحية يجب أن يكون بعد تاريخ التصنيع');
        }

        const result = db.stmts.expirationBatches.insert.run(
            productId,
            batchNumber.toString().trim(),
            manufacturingDate || null,
            expirationDate,
            quantity ?? null,
            unit || product.unit || null,
            location || null,
            notes || null
        );

        return this.getById(result.lastInsertRowid);
    }

    updateBatch(id, { batchNumber, manufacturingDate, expirationDate, quantity, unit, location, notes }) {
        const existing = this.getById(id);
        if (!existing) {
            throw new Error('الدفعة غير موجودة');
        }
        if (expirationDate) {
            const newManufacturingDate = manufacturingDate !== undefined ? manufacturingDate : existing.manufacturing_date;
            if (newManufacturingDate && new Date(expirationDate) < new Date(newManufacturingDate)) {
                throw new Error('تاريخ انتهاء الصلاحية يجب أن يكون بعد تاريخ التصنيع');
            }
        }

        db.stmts.expirationBatches.update.run(
            batchNumber !== undefined ? batchNumber.toString().trim() : existing.batch_number,
            manufacturingDate !== undefined ? (manufacturingDate || null) : existing.manufacturing_date,
            expirationDate !== undefined ? expirationDate : existing.expiration_date,
            quantity !== undefined ? quantity : existing.quantity,
            unit !== undefined ? (unit || null) : existing.unit,
            location !== undefined ? (location || null) : existing.location,
            notes !== undefined ? (notes || null) : existing.notes,
            id
        );

        return this.getById(id);
    }

    setBatchStatus(id, status) {
        if (!SETTABLE_STATUSES.includes(status)) {
            throw new Error(`حالة غير صالحة: ${status}`);
        }
        const existing = this.getById(id);
        if (!existing) {
            throw new Error('الدفعة غير موجودة');
        }
        db.stmts.expirationBatches.updateStatus.run(status, id);
        return this.getById(id);
    }

    deleteBatch(id) {
        const existing = this.getById(id);
        if (!existing) {
            throw new Error('الدفعة غير موجودة');
        }
        db.stmts.expirationBatches.delete.run(id);
        return { success: true };
    }

    getDashboardSummary() {
        return db.stmts.expirationBatches.getDashboardSummary.get();
    }

    // Excludes already-expired rows — those belong to getExpiredReport().
    getExpiringReport(days) {
        return this.getAll({ expiringWithinDays: days }).filter((b) => b.days_remaining >= 0);
    }

    getExpiredReport() {
        return this.getAll({ status: 'EXPIRED' });
    }

    getDiscardedReport() {
        return this.getAll({ status: 'DISCARDED' });
    }
}

module.exports = new ExpirationService();
