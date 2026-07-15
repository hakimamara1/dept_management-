import { z } from 'zod'

const pickedRef = z.object({ id: z.number(), name: z.string() })

const purchaseOrderItemSchema = z.object({
  product: pickedRef.nullable(),
  quantity: z.number().positive('الكمية يجب أن تكون أكبر من الصفر'),
  expectedUnitPrice: z.number().min(0, 'السعر لا يمكن أن يكون سالباً').optional()
})

// Field types stay nullable (matches the picker's "nothing selected yet" state);
// the "must pick one" rule is enforced in superRefine so the static type isn't
// fought into non-null just to satisfy an inline .refine() on the field itself
// — RHF's defaultValues need the honest nullable type.
export const createPurchaseOrderSchema = z
  .object({
    supplier: pickedRef.nullable(),
    orderDate: z.string().min(1, 'تاريخ الطلب مطلوب'),
    expectedDate: z.string().optional().or(z.literal('')),
    notes: z.string().trim().max(300).optional().or(z.literal('')),
    items: z.array(purchaseOrderItemSchema).min(1, 'أضف صنفاً واحداً على الأقل')
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

export type CreatePurchaseOrderFormValues = z.infer<typeof createPurchaseOrderSchema>

export const createPurchaseOrderDefaults: CreatePurchaseOrderFormValues = {
  supplier: null,
  orderDate: new Date().toISOString().split('T')[0],
  expectedDate: '',
  notes: '',
  items: [{ product: null, quantity: 1, expectedUnitPrice: undefined }]
}
