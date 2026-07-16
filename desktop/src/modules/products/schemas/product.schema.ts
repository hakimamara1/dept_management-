import { z } from 'zod'

export const PRODUCT_UNITS = [
  { value: 'piece', label: 'قطعة' },
  { value: 'kg', label: 'كيلو' },
  { value: 'box', label: 'علبة' },
  { value: 'liter', label: 'لتر' },
  { value: 'g', label: 'غرام' }
] as const

export const productSchema = z.object({
  name: z.string().trim().min(1, 'اسم المنتج مطلوب').max(200, 'الاسم طويل جداً'),
  barcode: z.string().trim().max(64).optional().or(z.literal('')),
  category: z.string().trim().max(100).optional().or(z.literal('')),
  unit: z.enum(['piece', 'kg', 'box', 'liter', 'g']),
  // Suggested selling price — separate from purchase cost, used to autofill
  // wholesale sales-invoice line prices. Optional: many products won't have
  // one set until someone in Sales needs it.
  defaultSalePrice: z.number().min(0, 'السعر لا يمكن أن يكون سالباً').nullable().optional()
})

export type ProductFormValues = z.infer<typeof productSchema>

export const productFormDefaults: ProductFormValues = {
  name: '',
  barcode: '',
  category: '',
  unit: 'piece',
  defaultSalePrice: null
}
