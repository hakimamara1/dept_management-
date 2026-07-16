import { z } from 'zod'

// productName/unit/unitPrice are always the source of truth (free-text
// snapshot on an immutable invoice line, per the module's decoupling rule).
// productId is an OPTIONAL link back to the catalog for reporting/autocomplete
// convenience only — picking a product via ProductPicker fills productId +
// productName + unit, but a line typed freehand is equally valid and just
// leaves productId null. Never used for stock/inventory logic.
const salesInvoiceItemSchema = z.object({
  productId: z.number().nullable().optional(),
  productName: z.string().trim().min(1, 'اسم الصنف مطلوب'),
  unit: z.string().trim().max(30).optional().or(z.literal('')),
  quantity: z.number().positive('الكمية يجب أن تكون أكبر من الصفر'),
  unitPrice: z.number().min(0, 'السعر لا يمكن أن يكون سالباً')
})

export const createSalesInvoiceSchema = z.object({
  invoiceDate: z.string().min(1, 'تاريخ الفاتورة مطلوب'),
  notes: z.string().trim().max(300).optional().or(z.literal('')),
  items: z.array(salesInvoiceItemSchema).min(1, 'أضف صنفاً واحداً على الأقل')
})

export type CreateSalesInvoiceFormValues = z.infer<typeof createSalesInvoiceSchema>

export const createSalesInvoiceDefaults: CreateSalesInvoiceFormValues = {
  invoiceDate: new Date().toISOString().split('T')[0],
  notes: '',
  items: [{ productId: null, productName: '', unit: '', quantity: 1, unitPrice: 0 }]
}
