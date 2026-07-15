// utils/arabicNormalizer.js
/**
 * Critical for Arabic OCR matching
 * Handles: tashkeel, alef variants, ya/alif maqsura, kaf variants, etc.
 */
const normalizeArabic = (text) => {
    if (!text) return '';

    return text
        .toLowerCase()
        .trim()
        // Remove tashkeel (diacritics)
        .replace(/[ً-ٰٟـ]/g, '')
        // Normalize alef variants to simple alef
        .replace(/[آأإ]/g, 'ا')
        // Normalize alif maqsura to ya
        .replace(/ى/g, 'ي')
        // Normalize kaf variants
        .replace(/[ڪګڬڭڮ]/g, 'ك')
        // Normalize ya variants
        .replace(/[یێېۑ]/g, 'ي')
        // Remove extra spaces
        .replace(/\s+/g, ' ')
        // Remove common noise words for matching (optional)
        .replace(/(انواع|اصلي|عادي|مرحي|كائنات)/g, '')
        .trim();
};

module.exports = { normalizeArabic };