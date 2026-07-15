import { z } from 'zod'

// Items are free text (no ProductPicker) — this module is deliberately
// decoupled from the purchasing-side product catalog.
const salesInvoiceItemSchema = z.object({
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
  items: [{ productName: '', unit: '', quantity: 1, unitPrice: 0 }]
}
