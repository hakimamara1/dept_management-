// services/invoiceProcessor.js
/**
 * Invoice Processor — Orchestrates the entire invoice pipeline.
 * 
 * Phase 2: Validation
 * Phase 3: Supplier Matching
 * Phase 4: Product Matching
 * Phase 5-6: Business Logic (delegated to services)
 * Phase 7: Human Review & Approval
 */

const db = require('../config/database');
const productMatcher = require('./productMatcher');
const supplierMatcher = require('./supplierMatcher');
const validationService = require('./validationService');

// ═══════════════════════════════════════════════════════════════
// NEW: Import the three services we just built
// ═══════════════════════════════════════════════════════════════
const stockService = require('./stockService');
const debtService = require('./debtService');
const { AccountingService } = require('./accountingService');

class InvoiceProcessor {

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Process OCR Result (Gemini JSON → Database)
    // This method stays mostly the same — only the imports changed
    // ═══════════════════════════════════════════════════════════════
    processOcrResult(ocrJson) {
        const transaction = db.transaction(() => {

            // ── Phase 2: Validate ──
            const validation = validationService.validateInvoice(ocrJson);

            const duplicateCheck = validationService.checkDuplicate(
                ocrJson.invoice_number, ocrJson.supplier?.name
            );
            if (duplicateCheck.isDuplicate) {
                throw new Error(`Duplicate invoice: ${duplicateCheck.existingInvoice.id}`);
            }

            // ── Phase 3: Match Supplier ──
            const supplierResult = supplierMatcher.findOrCreateSupplier(ocrJson.supplier || {});
            const supplierId = supplierResult.supplier.id;

            // Insert Invoice
            const invoiceResult = db.stmts.insertInvoice.run(
                ocrJson.invoice_number,
                this.parseDate(ocrJson.invoice_date),
                ocrJson.invoice_time || null,
                supplierId,
                ocrJson.currency || 'دج',
                ocrJson.previous_balance || 0,
                ocrJson.invoice_amount || 0,
                ocrJson.discount || 0,
                ocrJson.tax || 0,
                ocrJson.new_balance || 0,
                ocrJson.payment_method || null,
                ocrJson.notes || null,
                validation.status,
                JSON.stringify(validation.errors)
            );

            const invoiceId = invoiceResult.lastInsertRowid;
            const pendingItems = [];
            let allMatched = true;

            // ── Phase 4: Match Products ──
            for (const item of ocrJson.items || []) {
                const normalizedName = require('../utils/arabicNormalizer').normalizeArabic(item.product_name);
                const matchResult = productMatcher.matchProduct(item.product_name);

                const itemResult = db.stmts.insertInvoiceItem.run(
                    invoiceId,
                    matchResult.status === 'Matched' ? matchResult.suggestedId : null,
                    item.line_number,
                    item.product_name,
                    normalizedName,
                    item.package || null,
                    item.quantity,
                    item.unit_price,
                    item.discount || 0,
                    item.tax || 0,
                    item.total_price || (item.quantity * item.unit_price),
                    matchResult.status === 'Matched' ? 'Matched' : 'Pending',
                    matchResult.confidence,
                    matchResult.suggestedId,
                    item.notes || null
                );

                if (matchResult.status !== 'Matched') {
                    allMatched = false;
                    pendingItems.push({
                        itemId: itemResult.lastInsertRowid,
                        ocrName: item.product_name,
                        matchResult
                    });
                }
            }

            const finalStatus = (validation.isValid && allMatched) ? 'Approved' : 'Pending Review';
            db.stmts.updateInvoiceStatus.run(finalStatus, invoiceId);

            // ── Phase 5-6: Execute Business Logic ──
            // If fully approved, trigger all downstream effects
            if (finalStatus === 'Approved') {
                this.executeBusinessLogic(invoiceId);
            }

            return {
                invoiceId,
                status: finalStatus,
                supplier: supplierResult,
                pendingItems: finalStatus === 'Pending Review' ? pendingItems : [],
                validationErrors: validation.errors,
                validationWarnings: validation.warnings
            };
        });

        return transaction();
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Business Logic — THE BIG CHANGE
    // BEFORE: Inline SQL for stock, debt, accounting
    // AFTER: Delegated to dedicated services
    // ═══════════════════════════════════════════════════════════════
    executeBusinessLogic(invoiceId) {

        // ── Fetch invoice with supplier data ──
        const invoice = db.stmts.getInvoiceWithSupplier.get(invoiceId);
        if (!invoice) {
            throw new Error(`Invoice ${invoiceId} not found`);
        }

        // ── Fetch all items with product info ──
        const items = db.stmts.getInvoiceItems.all(invoiceId);

        // ═══════════════════════════════════════════════════════
        // 1. STOCK SERVICE — Record purchase movements
        // ═══════════════════════════════════════════════════════
        // BEFORE (inline SQL):
        //   db.stmts.insertStockMovement.run(productId, invoiceId, 'purchase', qty, cost, ref);
        //   db.stmts.upsertAnalytics.run(productId, total, date);
        //
        // AFTER (service call):
        for (const item of items) {
            if (!item.product_id) continue;

            // Let stockService handle the movement + analytics
            stockService.receivePurchase(
                item.product_id,
                invoiceId,
                item.quantity,
                item.unit_price,
                `Invoice #${invoice.invoice_number}`
            );

            // Update product analytics (total purchased, last purchase date)
            db.stmts.analytics.upsert.run(
                item.product_id,
                item.total_price,
                invoice.invoice_date
            );
        }

        // ═══════════════════════════════════════════════════════
        // 2. DEBT SERVICE — Record supplier debt
        // ═══════════════════════════════════════════════════════
        // BEFORE (inline SQL):
        //   const newBalance = supplierBalance + invoiceAmount;
        //   db.stmts.insertSupplierTransaction.run(supplierId, invoiceId, 'invoice', amount, newBalance, desc);
        //   db.stmts.updateSupplierBalance.run(newBalance, supplierId);
        //
        // AFTER (service call):
        debtService.addInvoiceDebt(
            invoice.supplier_id,
            invoiceId,
            invoice.invoice_amount,
            `Invoice #${invoice.invoice_number} — ${invoice.notes || ''}`
        );

        // ═══════════════════════════════════════════════════════
        // 3. UPDATE PRODUCT COSTS — Weighted Average Cost
        // ═══════════════════════════════════════════════════════
        // This stays here because it's invoice-specific math,
        // but uses stockService for the calculation
        for (const item of items) {
            if (!item.product_id) continue;

            // Use stockService to get computed stock data
            const stockData = stockService.getStockWithCost(item.product_id);

            if (stockData.totalQty > 0) {
                db.stmts.updateProductCost.run(
                    item.unit_price,
                    stockData.avgCost,
                    item.product_id
                );
            }
        }

        // ═══════════════════════════════════════════════════════
        // 4. ACCOUNTING SERVICE — Double-entry bookkeeping
        // ═══════════════════════════════════════════════════════
        // BEFORE (inline SQL):
        //   db.stmts.insertAccounting.run(invoiceId, date, 'inventory', amount, 0, desc);
        //   db.stmts.insertAccounting.run(invoiceId, date, 'accounts_payable', 0, amount, desc);
        //
        // AFTER (service call):
        AccountingService.recordPurchaseInvoice(
            invoiceId,
            invoice.invoice_date,
            invoice.invoice_amount,
            invoice.discount || 0,
            invoice.tax || 0,
            `Purchase from ${invoice.supplier_name || 'supplier'}`
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Human Approval — Also uses services now
    // ═══════════════════════════════════════════════════════════════
    approveInvoice(invoiceId, userDecisions) {
        const transaction = db.transaction(() => {

            // Process each user decision for unmatched products
            for (const decision of userDecisions) {
                const item = db.prepare('SELECT * FROM purchase_invoice_items WHERE id = ?').get(decision.itemId);

                if (decision.action === 'select_existing') {
                    // User says: "OCR 'عسل التمر' = Product #25"
                    productMatcher.confirmMatch(item.ocr_product_name, decision.productId);
                    db.stmts.updateItemProduct.run(decision.productId, 'UserSelected', decision.itemId);

                } else if (decision.action === 'create_new') {
                    // User says: "This is a completely new product"
                    const newProductId = productMatcher.createProductFromOcr(
                        item.ocr_product_name,
                        { unit: decision.unit || 'piece' }
                    );
                    db.stmts.updateItemProduct.run(newProductId, 'NewProduct', decision.itemId);
                }
            }

            // Mark invoice as approved
            db.stmts.updateInvoiceStatus.run('Approved', invoiceId);

            // ═══════════════════════════════════════════════════════
            // NEW: Trigger business logic via services
            // This is the same method called during auto-approval
            // ═══════════════════════════════════════════════════════
            this.executeBusinessLogic(invoiceId);

            return { success: true, invoiceId };
        });

        return transaction();
    }

    // ═══════════════════════════════════════════════════════════════
    // UTILITY: Parse DD/MM/YYYY → YYYY-MM-DD
    // ═══════════════════════════════════════════════════════════════
    parseDate(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateStr;
    }
}

module.exports = new InvoiceProcessor();