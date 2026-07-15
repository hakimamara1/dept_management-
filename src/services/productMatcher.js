// services/productMatcher.js
const db = require('../config/database');
const { normalizeArabic } = require('../utils/arabicNormalizer');

const THRESHOLDS = {
    EXACT: 0.95,
    HIGH: 0.85,
    MEDIUM: 0.70,
    LOW: 0.50
};

class ProductMatcher {
    matchProduct(ocrName) {
        const normalizedOcr = normalizeArabic(ocrName);

        // Step 1: Alias match (fastest — uses prepared statement)
        const aliasMatch = db.stmts.getAlias.get(normalizedOcr);
        if (aliasMatch) {
            // Increment usage count
            db.stmts.insertAlias.run(
                aliasMatch.product_id, aliasMatch.alias, normalizedOcr, 'alias_hit', 1.0
            );
            return {
                status: 'Matched',
                product: {
                    id: aliasMatch.product_id,
                    name: aliasMatch.product_name,
                    unit: aliasMatch.unit,
                    current_stock: aliasMatch.current_stock
                },
                confidence: 1.0,
                method: 'alias',
                suggestedId: aliasMatch.product_id
            };
        }

        // Step 2: Exact name match
        const allProducts = db.stmts.getAllProducts.all();
        for (const product of allProducts) {
            if (normalizeArabic(product.name) === normalizedOcr) {
                const fullProduct = db.stmts.getProductById.get(product.id);
                this.createAlias(product.id, ocrName, normalizedOcr, 'ai', 1.0);
                return {
                    status: 'Matched',
                    product: fullProduct,
                    confidence: 1.0,
                    method: 'exact_name',
                    suggestedId: product.id
                };
            }
        }

        // Step 3: Similarity search
        const candidates = [];
        for (const product of allProducts) {
            const normalizedProduct = normalizeArabic(product.name);
            const score = this.calculateSimilarity(normalizedOcr, normalizedProduct);

            if (score >= THRESHOLDS.LOW) {
                const fullProduct = db.stmts.getProductById.get(product.id);
                candidates.push({ product: fullProduct, score });
            }
        }

        candidates.sort((a, b) => b.score - a.score);

        if (candidates.length === 0) {
            return {
                status: 'NewProduct',
                product: null,
                confidence: 0,
                method: 'none',
                suggestedId: null,
                message: 'No similar products found'
            };
        }

        const best = candidates[0];

        if (best.score >= THRESHOLDS.EXACT) {
            this.createAlias(best.product.id, ocrName, normalizedOcr, 'ai', best.score);
            return {
                status: 'Matched',
                product: best.product,
                confidence: best.score,
                method: 'similarity_high',
                suggestedId: best.product.id
            };
        } else if (best.score >= THRESHOLDS.HIGH) {
            return {
                status: 'Pending',
                product: best.product,
                confidence: best.score,
                method: 'similarity_medium',
                suggestedId: best.product.id,
                alternatives: candidates.slice(1, 4),
                message: 'High similarity — please confirm'
            };
        } else if (best.score >= THRESHOLDS.MEDIUM) {
            return {
                status: 'Pending',
                product: best.product,
                confidence: best.score,
                method: 'similarity_low',
                suggestedId: best.product.id,
                alternatives: candidates.slice(1, 4),
                message: 'Possible match — confirmation needed'
            };
        } else {
            return {
                status: 'NewProduct',
                product: null,
                confidence: best.score,
                method: 'similarity_very_low',
                suggestedId: null,
                alternatives: candidates.slice(0, 3),
                message: 'No confident match found'
            };
        }
    }

    calculateSimilarity(s1, s2) {
        const jaro = this.jaroDistance(s1, s2);
        const jaroWinkler = this.jaroWinkler(s1, s2, jaro);

        const tokens1 = new Set(s1.split(' '));
        const tokens2 = new Set(s2.split(' '));
        const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
        const tokenScore = intersection.size / Math.max(tokens1.size, tokens2.size);

        return (jaroWinkler * 0.7) + (tokenScore * 0.3);
    }

    jaroDistance(s1, s2) {
        if (s1 === s2) return 1.0;
        if (!s1.length || !s2.length) return 0.0;

        const matchDistance = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
        const s1Matches = new Array(s1.length).fill(false);
        const s2Matches = new Array(s2.length).fill(false);
        let matches = 0;
        let transpositions = 0;

        for (let i = 0; i < s1.length; i++) {
            const start = Math.max(0, i - matchDistance);
            const end = Math.min(i + matchDistance + 1, s2.length);
            for (let j = start; j < end; j++) {
                if (s2Matches[j] || s1[i] !== s2[j]) continue;
                s1Matches[i] = true;
                s2Matches[j] = true;
                matches++;
                break;
            }
        }

        if (!matches) return 0.0;

        let k = 0;
        for (let i = 0; i < s1.length; i++) {
            if (!s1Matches[i]) continue;
            while (!s2Matches[k]) k++;
            if (s1[i] !== s2[k]) transpositions++;
            k++;
        }

        return ((matches / s1.length) + (matches / s2.length) + ((matches - transpositions / 2) / matches)) / 3;
    }

    jaroWinkler(s1, s2, jaro) {
        let prefix = 0;
        for (let i = 0; i < Math.min(s1.length, s2.length); i++) {
            if (s1[i] === s2[i]) prefix++;
            else break;
        }
        return jaro + (Math.min(prefix, 4) * 0.1 * (1 - jaro));
    }

    createAlias(productId, originalName, normalizedName, source, confidence) {
        try {
            db.stmts.insertAlias.run(productId, originalName, normalizedName, source, confidence);
        } catch (err) {
            // If ON CONFLICT not supported, handle gracefully
            console.log('Alias upsert handled:', normalizedName);
        }
    }

    // NOTE: only writes the alias (for future OCR matches). The current
    // invoice's line item is updated separately by the caller, scoped to
    // its own item id — this must never touch purchase_invoice_items
    // directly, or it silently repoints every historical item that happens
    // to share the same normalized OCR text across unrelated invoices.
    confirmMatch(ocrName, productId) {
        const normalized = normalizeArabic(ocrName);
        this.createAlias(productId, ocrName, normalized, 'user_confirmed', 1.0);
    }

    createProductFromOcr(ocrName, itemData) {
        const result = db.prepare(
            'INSERT INTO products (name, unit) VALUES (?, ?)'
        ).run(ocrName, itemData.unit || 'piece');

        const productId = result.lastInsertRowid;
        this.createAlias(productId, ocrName, normalizeArabic(ocrName), 'manual', 1.0);

        return productId;
    }
}

module.exports = new ProductMatcher();