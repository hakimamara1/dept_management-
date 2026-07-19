import { z } from 'zod'

// For a supplier's handwritten invoice — typed in directly, no OCR JSON.
// Same nullable-picker + superRefine shape as purchase-orders' create form.
const pickedRef = z.object({ id: z.number(), name: z.string() })

const manualInvoiceItemSchema = z.object({
  product: pickedRef.nullable(),
  quantity: z.number().positive('الكمية يجب أن تكون أكبر من الصفر'),
  unitPrice: z.number().min(0, 'السعر لا يمكن أن يكون سالباً')
})

export const manualInvoiceSchema = z
  .object({
    supplier: pickedRef.nullable(),
    invoiceNumber: z.string().trim().min(1, 'رقم الفاتورة مطلوب'),
    invoiceDate: z.string().min(1, 'تاريخ الفاتورة مطلوب'),
    discount: z.number().min(0).optional(),
    tax: z.number().min(0).optional(),
    paymentMethod: z.string().trim().optional().or(z.literal('')),
    notes: z.string().trim().max(300).optional().or(z.literal('')),
    items: z.array(manualInvoiceItemSchema).min(1, 'أضف صنفاً واحداً على الأقل')
  })
  .superRefine((data, ctx) => {
    if (!data.supplier) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'اختر مورداً', path: ['supplier'] })
    }
    data.items.forEach((item, index) => {
      if (!item.product) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'اختر منتجاً', path: ['items', index, 'product'] })
      }
    })
  })

export type ManualInvoiceFormValues = z.infer<typeof manualInvoiceSchema>

export const manualInvoiceDefaults: ManualInvoiceFormValues = {
  supplier: null,
  invoiceNumber: '',
  invoiceDate: new Date().toISOString().split('T')[0],
  discount: undefined,
  tax: undefined,
  paymentMethod: '',
  notes: '',
  items: [{ product: null, quantity: 1, unitPrice: 0 }]
}
