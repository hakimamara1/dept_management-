// services/invoiceProcessor.js
/**
 * Invoice Processor — Orchestrates the entire invoice pipeline.
 *
 * Two-state ERP workflow (see docs/business-rules.md):
 *   Pending Review — fully editable draft. Nothing here is a business
 *     record yet: no stock movement, no supplier debt, no accounting.
 *     Every OCR import lands here, regardless of match confidence — there
 *     is no auto-approve fast path. Items are corrected/matched directly
 *     via updateItem/addItem/deleteItem, saved immediately, but inert.
 *   Approved — the explicit "Approve Invoice" action. Requires every item
 *     to already carry a real product_id (fully matched). Posts stock,
 *     supplier debt, product cost, and accounting in one shot
 *     (executeBusinessLogic), then the invoice is permanently locked:
 *     no further item edits, ever. Only `notes` may still change.
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
const { normalizeArabic } = require('../utils/arabicNormalizer');
const { parseNumber } = require('../utils/parseNumber');

// ═══════════════════════════════════════════════════════════════
// NEW: Import the three services we just built
// ═══════════════════════════════════════════════════════════════
const stockService = require('./stockService');
const debtService = require('./debtService');
const { AccountingService } = require('./accountingService');

class InvoiceProcessor {

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Process OCR Result (Gemini JSON → Database)
    // Always lands at 'Pending Review', regardless of match confidence —
    // no auto-approve. The business owner reviews and corrects every
    // invoice before it becomes a real business record (see class docblock).
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

            // Sanitize every OCR-supplied numeric field up front. OCR
            // extraction sometimes returns a formatted string ("99,220.00")
            // instead of a plain number — used unconverted, `number + that
            // string` is JS string concatenation, not addition, and
            // silently corrupts any running total it touches (this is a
            // real incident that happened — see ADR-017). Nothing below
            // this point ever reads ocrJson's raw numeric fields again.
            const sanitizedItems = (ocrJson.items || []).map((item) => {
                const quantity = parseNumber(item.quantity);
                const unitPrice = parseNumber(item.unit_price);
                const totalPrice = item.total_price != null ? parseNumber(item.total_price) : quantity * unitPrice;
                return {
                    ...item,
                    quantity,
                    unit_price: unitPrice,
                    discount: parseNumber(item.discount),
                    tax: parseNumber(item.tax),
                    total_price: totalPrice
                };
            });

            // The calculated total (sum of line items) is the single source
            // of truth for invoice_amount — never the OCR header figure,
            // which is stored separately in ocr_header_total purely for
            // reference/validation (see business-rules.md).
            const calculatedTotal = sanitizedItems.reduce((sum, item) => sum + item.total_price, 0);

            // Insert Invoice — always 'Pending Review' at creation time
            const invoiceResult = db.stmts.insertInvoice.run(
                ocrJson.invoice_number,
                this.parseDate(ocrJson.invoice_date),
                ocrJson.invoice_time || null,
                supplierId,
                ocrJson.currency || 'دج',
                parseNumber(ocrJson.previous_balance),
                calculatedTotal,
                parseNumber(ocrJson.invoice_amount, null),
                parseNumber(ocrJson.discount),
                parseNumber(ocrJson.tax),
                parseNumber(ocrJson.new_balance),
                ocrJson.payment_method || null,
                ocrJson.notes || null,
                'Pending Review',
                JSON.stringify(validation.errors),
                'ocr'
            );

            const invoiceId = invoiceResult.lastInsertRowid;
            const pendingItems = [];

            // ── Phase 4: Match Products (best-effort suggestion only —
            // nothing here is final, the user corrects it in the review UI) ──
            for (const item of sanitizedItems) {
                const normalizedName = normalizeArabic(item.product_name);
                const matchResult = productMatcher.matchProduct(item.product_name);

                const itemResult = db.stmts.insertInvoiceItem.run(
                    invoiceId,
                    matchResult.status === 'Matched' ? matchResult.suggestedId : null,
                    item.line_number,
                    item.product_name,
                    normalizedName,
                    item.package || null,
                    item.unit || null,
                    item.quantity,
                    item.unit_price,
                    item.discount,
                    item.tax,
                    item.total_price,
                    matchResult.status === 'Matched' ? 'Matched' : 'Pending',
                    matchResult.confidence,
                    matchResult.suggestedId,
                    item.notes || null
                );

                if (matchResult.status !== 'Matched') {
                    pendingItems.push({
                        itemId: itemResult.lastInsertRowid,
                        ocrName: item.product_name,
                        matchResult
                    });
                }
            }

            return {
                invoiceId,
                status: 'Pending Review',
                supplier: supplierResult,
                pendingItems,
                validationErrors: validation.errors,
                validationWarnings: validation.warnings
            };
        });

        return transaction();
    }

    // ═══════════════════════════════════════════════════════════════
    // Manual entry — for a supplier's handwritten invoice, where there's no
    // OCR JSON to paste. Simpler than processOcrResult: the supplier is
    // already picked (supplierId known, no supplierMatcher), and every item
    // already carries a deliberate product decision from the picker (no
    // OCR-suggested matching phase, no 'Pending' items possible). Lands at
    // 'Pending Review' just like an OCR import, so it goes through the same
    // edit/approve pipeline from there.
    // ═══════════════════════════════════════════════════════════════
    createManualInvoice({ supplierId, invoiceNumber, invoiceDate, invoiceTime, currency, discount, tax, paymentMethod, notes, items }) {
        if (!supplierId) throw new Error('المورد مطلوب');
        if (!invoiceNumber || !invoiceNumber.toString().trim()) throw new Error('رقم الفاتورة مطلوب');
        if (!invoiceDate) throw new Error('تاريخ الفاتورة مطلوب');
        if (!items || !items.length) throw new Error('يجب أن تحتوي الفاتورة على صنف واحد على الأقل');

        const transaction = db.transaction(() => {
            const sanitizedItems = items.map((item) => {
                const quantity = parseNumber(item.quantity);
                const unitPrice = parseNumber(item.unitPrice);
                if (!quantity || quantity <= 0) throw new Error('الكمية يجب أن تكون أكبر من الصفر لكل صنف');
                if (unitPrice < 0) throw new Error('السعر غير صالح');
                return { ...item, quantity, unitPrice, totalPrice: quantity * unitPrice };
            });

            const calculatedTotal = sanitizedItems.reduce((sum, item) => sum + item.totalPrice, 0);
            const previousBalance = debtService.getCurrentBalance(supplierId);
            const newBalance = previousBalance + calculatedTotal;

            let invoiceResult;
            try {
                invoiceResult = db.stmts.insertInvoice.run(
                    invoiceNumber.toString().trim(),
                    invoiceDate,
                    invoiceTime || null,
                    supplierId,
                    currency || 'دج',
                    previousBalance,
                    calculatedTotal,
                    null, // ocr_header_total — nothing to compare against for a manual entry
                    parseNumber(discount),
                    parseNumber(tax),
                    newBalance,
                    paymentMethod || null,
                    notes || null,
                    'Pending Review',
                    '[]',
                    'manual'
                );
            } catch (err) {
                if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || /UNIQUE constraint failed/.test(err.message)) {
                    throw new Error('رقم الفاتورة موجود مسبقاً لهذا المورد');
                }
                throw err;
            }

            const invoiceId = invoiceResult.lastInsertRowid;

            sanitizedItems.forEach((item, index) => {
                if (!item.productId && !item.createNewProduct) {
                    throw new Error('اختر منتجاً لكل صنف أو أنشئ منتجاً جديداً');
                }
                const name = (item.productName || '').toString().trim();
                if (!name) throw new Error('اسم الصنف مطلوب');

                const resolution = this._resolveItemProduct(name, {
                    productId: item.productId,
                    createNewProduct: item.createNewProduct
                });

                db.stmts.insertInvoiceItem.run(
                    invoiceId,
                    resolution.productId,
                    index + 1,
                    name,
                    normalizeArabic(name),
                    null,
                    item.unit || null,
                    item.quantity,
                    item.unitPrice,
                    0,
                    0,
                    item.totalPrice,
                    resolution.matchStatus,
                    null,
                    null,
                    null
                );
            });

            return { invoiceId, status: 'Pending Review' };
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
    // PENDING-REVIEW ITEM EDITING — the only place matching/correction
    // happens now. Every method here throws if the invoice isn't still
    // 'Pending Review'; once Approved, none of this is reachable, by
    // design (see class docblock and business-rules.md).
    // ═══════════════════════════════════════════════════════════════
    _requirePendingInvoice(invoiceId) {
        const invoice = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(invoiceId);
        if (!invoice) {
            throw new Error('الفاتورة غير موجودة');
        }
        if (invoice.status !== 'Pending Review') {
            throw new Error('لا يمكن التعديل — الفاتورة ليست في حالة المراجعة');
        }
        return invoice;
    }

    // Resolves an item's product link from a decision payload shared by
    // updateInvoiceItem and addInvoiceItem — either an existing productId
    // or a brand-new product created on the spot (with its own unit).
    _resolveItemProduct(ocrName, { productId, createNewProduct }) {
        if (productId) {
            productMatcher.confirmMatch(ocrName, productId);
            return { productId, matchStatus: 'UserSelected' };
        }
        if (createNewProduct) {
            const newProductId = productMatcher.createProductFromOcr(ocrName, { unit: createNewProduct.unit || 'piece' });
            return { productId: newProductId, matchStatus: 'NewProduct' };
        }
        return null;
    }

    updateInvoiceItem(invoiceId, itemId, { productName, quantity, unit, unitPrice, productId, createNewProduct }) {
        const transaction = db.transaction(() => {
            this._requirePendingInvoice(invoiceId);
            const item = db.prepare('SELECT * FROM purchase_invoice_items WHERE id = ? AND invoice_id = ?').get(itemId, invoiceId);
            if (!item) {
                throw new Error('الصنف غير موجود في هذه الفاتورة');
            }

            const newName = productName && productName.toString().trim() ? productName.toString().trim() : item.ocr_product_name;
            const newQty = quantity != null ? parseNumber(quantity) : parseNumber(item.quantity);
            const newUnit = unit !== undefined ? (unit || null) : item.unit;
            const newPrice = unitPrice != null ? parseNumber(unitPrice) : parseNumber(item.unit_price);
            if (!newQty || newQty <= 0) throw new Error('الكمية يجب أن تكون أكبر من الصفر');
            if (newPrice < 0) throw new Error('السعر غير صالح');
            const newTotal = newQty * newPrice;

            const resolution = this._resolveItemProduct(newName, { productId, createNewProduct });
            const finalProductId = resolution ? resolution.productId : item.product_id;
            const finalMatchStatus = resolution ? resolution.matchStatus : item.match_status;

            db.stmts.updateInvoiceItem.run(
                newName, newUnit, newQty, newPrice, newTotal,
                finalProductId, finalMatchStatus, itemId
            );
            db.stmts.recalculateInvoiceTotal.run(invoiceId, invoiceId);

            return db.stmts.getInvoiceItems.all(invoiceId).find((i) => i.id === itemId);
        });

        return transaction();
    }

    addInvoiceItem(invoiceId, { productName, quantity, unit, unitPrice, productId, createNewProduct }) {
        const transaction = db.transaction(() => {
            this._requirePendingInvoice(invoiceId);
            if (!productName || !productName.toString().trim()) throw new Error('اسم الصنف مطلوب');
            const qty = parseNumber(quantity);
            const price = parseNumber(unitPrice);
            if (!qty || qty <= 0) throw new Error('الكمية يجب أن تكون أكبر من الصفر');
            if (price == null || price < 0 || Number.isNaN(price)) throw new Error('السعر غير صالح');

            const name = productName.toString().trim();
            const normalizedName = normalizeArabic(name);
            const total = qty * price;
            const resolution = this._resolveItemProduct(name, { productId, createNewProduct });

            const maxLine = db.stmts.getMaxLineNumber.get(invoiceId).maxLine || 0;

            const result = db.stmts.insertInvoiceItem.run(
                invoiceId,
                resolution ? resolution.productId : null,
                maxLine + 1,
                name,
                normalizedName,
                null,
                unit || null,
                qty,
                price,
                0,
                0,
                total,
                resolution ? resolution.matchStatus : 'Pending',
                null,
                null,
                null
            );
            db.stmts.recalculateInvoiceTotal.run(invoiceId, invoiceId);

            return db.stmts.getInvoiceItems.all(invoiceId).find((i) => i.id === result.lastInsertRowid);
        });

        return transaction();
    }

    deleteInvoiceItem(invoiceId, itemId) {
        const transaction = db.transaction(() => {
            this._requirePendingInvoice(invoiceId);
            const item = db.prepare('SELECT * FROM purchase_invoice_items WHERE id = ? AND invoice_id = ?').get(itemId, invoiceId);
            if (!item) {
                throw new Error('الصنف غير موجود في هذه الفاتورة');
            }
            const { count } = db.stmts.countInvoiceItems.get(invoiceId);
            if (count <= 1) {
                throw new Error('لا يمكن حذف آخر صنف في الفاتورة');
            }
            db.stmts.deleteInvoiceItem.run(itemId);
            db.stmts.recalculateInvoiceTotal.run(invoiceId, invoiceId);
            return { success: true };
        });

        return transaction();
    }

    updateInvoiceNotes(invoiceId, notes) {
        const invoice = db.prepare('SELECT id FROM purchase_invoices WHERE id = ?').get(invoiceId);
        if (!invoice) {
            throw new Error('الفاتورة غير موجودة');
        }
        db.stmts.updateInvoiceNotes.run(notes || null, invoiceId);
        return { success: true };
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Approve Invoice — the one and only posting step. Requires
    // every item to already carry a real product_id (fully matched via the
    // editing methods above). Once this succeeds, the invoice is locked:
    // stock/debt/accounting are posted and no item can be edited again.
    // ═══════════════════════════════════════════════════════════════
    approveInvoice(invoiceId) {
        const transaction = db.transaction(() => {
            const invoice = this._requirePendingInvoice(invoiceId);

            const items = db.stmts.getInvoiceItems.all(invoiceId);
            if (!items.length) {
                throw new Error('لا يمكن اعتماد فاتورة بدون أصناف');
            }
            const unmatched = items.filter((i) => !i.product_id);
            if (unmatched.length) {
                const names = unmatched.map((i) => i.ocr_product_name).join('، ');
                throw new Error(`لا يمكن اعتماد الفاتورة — أصناف غير مطابقة بعد: ${names}`);
            }

            db.stmts.approveInvoiceStatus.run(invoiceId);
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