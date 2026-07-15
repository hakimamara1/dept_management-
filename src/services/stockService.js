// services/stockService.js
const db = require('../config/database');

/**
 * Stock Service — Centralized stock management.
 * RULE: Never update products.current_stock directly.
 * Always use stock_movements. Current stock = SUM(stock_movements.quantity).
 */

class StockService {
    /**
     * Get current stock for a product (computed from movements).
     * @param {number} productId
     * @returns {number} Current quantity in stock
     */
    getCurrentStock(productId) {
        const result = db.stmts.stock.getCurrent.get(productId);
        return Number(result.stock);
    }

    /**
     * Get current stock with total cost (for average cost calculation).
     * @param {number} productId
     * @returns {{totalQty: number, totalCost: number, avgCost: number}}
     */
    getStockWithCost(productId) {
        const result = db.stmts.stock.getCurrentWithCost.get(productId);
        const totalQty = Number(result.total_qty);
        const totalCost = Number(result.total_cost);
        return {
            totalQty,
            totalCost,
            avgCost: totalQty > 0 ? totalCost / totalQty : 0
        };
    }

    /**
     * Record a stock movement.
     * @param {Object} movement
     * @param {number} movement.productId
     * @param {number} [movement.invoiceId] — null for adjustments
     * @param {string} movement.type — 'purchase', 'sale', 'adjustment', 'return', 'damage'
     * @param {number} movement.quantity — positive = in, negative = out
     * @param {number} [movement.unitCost] — cost per unit (for purchases)
     * @param {string} [movement.reference] — invoice number or reason
     */
    addMovement({ productId, invoiceId = null, type, quantity, unitCost = 0, reference = '' }) {
        const result = db.stmts.stock.insert.run(
            productId,
            invoiceId,
            type,
            quantity,
            unitCost,
            reference
        );

        return {
            movementId: result.lastInsertRowid,
            productId,
            newStock: this.getCurrentStock(productId)
        };
    }

    /**
     * Record a purchase (positive movement).
     * Convenience wrapper around addMovement.
     */
    receivePurchase(productId, invoiceId, quantity, unitCost, reference) {
        return this.addMovement({
            productId,
            invoiceId,
            type: 'purchase',
            quantity: Math.abs(quantity),  // Ensure positive
            unitCost,
            reference
        });
    }

    /**
     * Record a sale (negative movement).
     */
    recordSale(productId, invoiceId, quantity, unitCost, reference) {
        return this.addMovement({
            productId,
            invoiceId,
            type: 'sale',
            quantity: -Math.abs(quantity),  // Ensure negative
            unitCost,
            reference
        });
    }

    /**
     * Record stock adjustment (e.g., after physical count).
     */
    adjustStock(productId, actualQuantity, reason) {
        const currentStock = this.getCurrentStock(productId);
        const difference = actualQuantity - currentStock;

        if (difference === 0) {
            return { movementId: null, productId, newStock: currentStock, difference: 0 };
        }

        const result = this.addMovement({
            productId,
            type: 'adjustment',
            quantity: difference,
            reference: reason || `Stock adjustment: ${currentStock} → ${actualQuantity}`
        });

        return {
            ...result,
            previousStock: currentStock,
            difference
        };
    }

    /**
     * Get full movement history for a product.
     * @param {number} productId
     * @returns {Array} All stock movements
     */
    getMovementHistory(productId) {
        return db.stmts.stock.getByProduct.all(productId);
    }

    /**
     * Get stock movements within a date range.
     * @param {string} startDate — YYYY-MM-DD
     * @param {string} endDate — YYYY-MM-DD
     */
    getMovementsByDateRange(startDate, endDate) {
        return db.stmts.stock.getMovementsByDate.all(startDate, endDate);
    }

    /**
     * Get complete stock summary for all products.
     * @returns {Array} Each product with current_stock, avg_cost, stock_value
     */
    getStockSummary() {
        return db.stmts.stock.getProductStockSummary.all();
    }

    /**
     * Get total value of all inventory.
     * @returns {number} Total stock value in DZD
     */
    getTotalStockValue() {
        const result = db.stmts.stock.getStockValueTotal.get();
        return Number(result.total_value || 0);
    }

    /**
     * Check if product has enough stock for a sale.
     * @param {number} productId
     * @param {number} requestedQty
     * @returns {{available: boolean, currentStock: number, deficit: number}}
     */
    checkAvailability(productId, requestedQty) {
        const currentStock = this.getCurrentStock(productId);
        const available = currentStock >= requestedQty;
        return {
            available,
            currentStock,
            deficit: available ? 0 : requestedQty - currentStock
        };
    }

    /**
     * Get products with low stock (below threshold).
     * @param {number} threshold
     */
    getLowStockProducts(threshold = 10) {
        return db.prepare(QUERIES.products.getLowStock).all(threshold);
    }

    /**
     * Batch stock receipt (for invoice processing).
     * Wrapped in transaction by caller.
     */
    processInvoiceStock(invoiceId, items) {
        const movements = [];
        for (const item of items) {
            if (!item.product_id) continue;
            const mov = this.receivePurchase(
                item.product_id,
                invoiceId,
                item.quantity,
                item.unit_price,
                `Invoice #${item.invoice_id}`
            );
            movements.push(mov);
        }
        return movements;
    }
}

module.exports = new StockService();