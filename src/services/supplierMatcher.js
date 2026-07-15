// services/supplierMatcher.js
const db = require('../config/database');
const { normalizeArabic } = require('../utils/arabicNormalizer');

const findOrCreateSupplier = (supplierData) => {
    const normalizedName = normalizeArabic(supplierData.name);

    // 1. Exact match (case-insensitive)
    let supplier = db.stmts.getSupplierByName.get(supplierData.name);
    if (supplier) {
        return { supplier, action: 'found', confidence: 1.0 };
    }

    // 2. Fuzzy match across all suppliers
    const allSuppliers = db.stmts.getAllSuppliers.all();
    let bestMatch = null;
    let bestScore = 0;

    for (const s of allSuppliers) {
        const score = calculateSimilarity(normalizedName, normalizeArabic(s.name));
        if (score > bestScore && score > 0.85) {
            bestScore = score;
            bestMatch = s;
        }
    }

    if (bestMatch) {
        supplier = db.stmts.getSupplierByName.get(bestMatch.name);
        return { supplier, action: 'fuzzy_matched', confidence: bestScore };
    }

    // 3. Create new
    const result = db.stmts.insertSupplier.run(
        supplierData.name,
        supplierData.phone || null,
        supplierData.email || null,
        supplierData.address || null,
        supplierData.tax_number || null,
        supplierData.commercial_register || null
    );

    supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(result.lastInsertRowid);
    return { supplier, action: 'created', confidence: 1.0 };
};

const calculateSimilarity = (s1, s2) => {
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;
    return Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
};

module.exports = { findOrCreateSupplier };