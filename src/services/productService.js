// services/productService.js
const db = require('../config/database');

class ProductService {
    // Merges `mergeId` into `keepId`: reassigns every reference to mergeId
    // across purchasing/stock/analytics history onto keepId, then deletes
    // the mergeId product row. Use when the same real product was
    // accidentally created twice.
    mergeProducts(keepId, mergeId) {
        const transaction = db.transaction(() => {
            if (keepId === mergeId) {
                throw new Error('لا يمكن دمج المنتج مع نفسه');
            }

            const keep = db.stmts.getProductById.get(keepId);
            const merge = db.stmts.getProductById.get(mergeId);
            if (!keep || !merge) {
                throw new Error('أحد المنتجين غير موجود');
            }

            db.prepare('UPDATE stock_movements SET product_id = ? WHERE product_id = ?').run(keepId, mergeId);
            db.prepare('UPDATE purchase_invoice_items SET product_id = ? WHERE product_id = ?').run(keepId, mergeId);
            db.prepare('UPDATE purchase_invoice_items SET suggested_product_id = ? WHERE suggested_product_id = ?').run(keepId, mergeId);
            db.prepare('UPDATE purchase_invoice_items SET user_selected_product_id = ? WHERE user_selected_product_id = ?').run(keepId, mergeId);
            db.prepare('UPDATE purchase_order_items SET product_id = ? WHERE product_id = ?').run(keepId, mergeId);

            // expiration_batches.product_id is immutable after creation via the
            // normal update path (queries.js deliberately omits it there) — a
            // merge is the one deliberate exception, since the merged-away
            // product is being deleted entirely, not edited in place.
            db.prepare('UPDATE expiration_batches SET product_id = ? WHERE product_id = ?').run(keepId, mergeId);

            // product_analytics.product_id is a PRIMARY KEY — both sides may
            // already have a row, so a plain reassign could collide. Combine
            // instead of overwrite.
            const keepAnalytics = db.prepare('SELECT * FROM product_analytics WHERE product_id = ?').get(keepId);
            const mergeAnalytics = db.prepare('SELECT * FROM product_analytics WHERE product_id = ?').get(mergeId);
            if (mergeAnalytics) {
                if (keepAnalytics) {
                    const totalPurchased = (keepAnalytics.total_purchased || 0) + (mergeAnalytics.total_purchased || 0);
                    const totalSold = (keepAnalytics.total_sold || 0) + (mergeAnalytics.total_sold || 0);
                    const lastPurchaseDate = [keepAnalytics.last_purchase_date, mergeAnalytics.last_purchase_date]
                        .filter(Boolean).sort().pop() ?? null;
                    const lastSaleDate = [keepAnalytics.last_sale_date, mergeAnalytics.last_sale_date]
                        .filter(Boolean).sort().pop() ?? null;

                    db.prepare(
                        `UPDATE product_analytics
                             SET total_purchased = ?, total_sold = ?,
                                 last_purchase_date = ?, last_sale_date = ?,
                                 updated_at = CURRENT_TIMESTAMP
                             WHERE product_id = ?`
                    ).run(totalPurchased, totalSold, lastPurchaseDate, lastSaleDate, keepId);
                    db.prepare('DELETE FROM product_analytics WHERE product_id = ?').run(mergeId);
                } else {
                    db.prepare('UPDATE product_analytics SET product_id = ? WHERE product_id = ?').run(keepId, mergeId);
                }
            }

            // product_aliases.normalized_alias is UNIQUE globally — an alias
            // already used under the keep product can't be reassigned without
            // violating that constraint, so drop the duplicate instead.
            const keepAliases = new Set(
                db.prepare('SELECT normalized_alias FROM product_aliases WHERE product_id = ?').all(keepId)
                    .map((r) => r.normalized_alias)
            );
            const mergeAliases = db.prepare('SELECT * FROM product_aliases WHERE product_id = ?').all(mergeId);
            for (const alias of mergeAliases) {
                if (keepAliases.has(alias.normalized_alias)) {
                    db.prepare('DELETE FROM product_aliases WHERE id = ?').run(alias.id);
                } else {
                    db.prepare('UPDATE product_aliases SET product_id = ? WHERE id = ?').run(keepId, alias.id);
                }
            }

            db.prepare('DELETE FROM products WHERE id = ?').run(mergeId);

            return { success: true, keepId };
        });

        return transaction();
    }
}

module.exports = new ProductService();
