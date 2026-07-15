import { z } from 'zod'

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'نقداً' },
  { value: 'bank_transfer', label: 'تحويل بنكي' },
  { value: 'check', label: 'شيك' }
] as const

const pickedSupplier = z.object({ id: z.number(), name: z.string() })

export const recordPaymentSchema = z
  .object({
    supplier: pickedSupplier.nullable(),
    amount: z.number().positive('المبلغ يجب أن يكون أكبر من الصفر'),
    paymentMethod: z.enum(['cash', 'bank_transfer', 'check']),
    reference: z.string().trim().max(100).optional().or(z.literal('')),
    notes: z.string().trim().max(300).optional().or(z.literal('')),
    date: z.string().min(1, 'التاريخ مطلوب')
  })
  .superRefine((data, ctx) => {
    if (!data.supplier) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'اختر مورداً', path: ['supplier'] })
    }
  })

export type RecordPaymentFormValues = z.infer<typeof recordPaymentSchema>

export const recordPaymentDefaults: RecordPaymentFormValues = {
  supplier: null,
  amount: 0,
  paymentMethod: 'cash',
  reference: '',
  notes: '',
  date: new Date().toISOString().split('T')[0]
}
