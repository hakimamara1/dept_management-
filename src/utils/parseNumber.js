// utils/parseNumber.js
/**
 * Coerces an OCR-supplied or user-supplied numeric field to a real JS
 * number. OCR extraction sometimes returns formatted strings ("99,220.00")
 * instead of plain numbers — used unconverted, `number + "99,220.00"` is
 * JS string concatenation, not addition, and silently corrupts any running
 * total it touches (see docs/decisions.md ADR-017). Every numeric field
 * that originates from OCR JSON or an API request body must go through
 * this before any arithmetic or storage.
 */
function parseNumber(value, fallback = 0) {
    if (value == null || value === '') return fallback;
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    if (typeof value === 'string') {
        const cleaned = value.replace(/,/g, '').trim();
        const parsed = parseFloat(cleaned);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
}

module.exports = { parseNumber };
