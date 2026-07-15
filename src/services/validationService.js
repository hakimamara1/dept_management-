// services/validationService.js
const db = require('../config/database');

const validateInvoice = (json) => {
    const errors = [];
    const warnings = [];

    if (!json.invoice_number?.toString().trim()) {
        errors.push({ field: 'invoice_number', message: 'Invoice number is required' });
    }

    if (!json.supplier?.name?.trim()) {
        errors.push({ field: 'supplier.name', message: 'Supplier name is required' });
    }

    if (!json.invoice_date) {
        errors.push({ field: 'invoice_date', message: 'Invoice date is required' });
    } else {
        const parts = json.invoice_date.split('/');
        if (parts.length !== 3) {
            errors.push({ field: 'invoice_date', message: 'Invalid format. Expected DD/MM/YYYY' });
        }
    }

    if (!json.items?.length) {
        errors.push({ field: 'items', message: 'Invoice must contain at least one item' });
    } else {
        json.items.forEach((item, index) => {
            if (!item.product_name?.trim()) {
                errors.push({ field: `items[${index}].product_name`, message: 'Product name required' });
            }
            if (!item.quantity || item.quantity <= 0) {
                errors.push({ field: `items[${index}].quantity`, message: 'Quantity must be > 0' });
            }
            if (!item.unit_price || item.unit_price <= 0) {
                errors.push({ field: `items[${index}].unit_price`, message: 'Unit price must be > 0' });
            }

            const expectedTotal = item.quantity * item.unit_price;
            if (item.total_price && Math.abs(item.total_price - expectedTotal) > 0.01) {
                warnings.push({
                    field: `items[${index}].total_price`,
                    message: `Math mismatch. Expected ${expectedTotal}, got ${item.total_price}`
                });
            }
        });
    }

    if (json.previous_balance !== undefined && json.invoice_amount !== undefined && json.new_balance !== undefined) {
        const expected = json.previous_balance + json.invoice_amount - (json.discount || 0);
        if (Math.abs(expected - json.new_balance) > 0.01) {
            warnings.push({ field: 'new_balance', message: `Expected ${expected}, got ${json.new_balance}` });
        }
    }

    return {
        isValid: errors.length === 0,
        status: errors.length === 0 ? 'Approved' : 'Pending Review',
        errors,
        warnings
    };
};

// Synchronous duplicate check
const checkDuplicate = (invoiceNumber, supplierName) => {
    const existing = db.stmts.getInvoiceByNumber.get(invoiceNumber, supplierName);
    return existing ? { isDuplicate: true, existingInvoice: existing } : { isDuplicate: false };
};

module.exports = { validateInvoice, checkDuplicate };