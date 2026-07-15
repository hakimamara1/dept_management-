import { z } from 'zod'

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'نقداً' },
  { value: 'bank_transfer', label: 'تحويل بنكي' },
  { value: 'check', label: 'شيك' }
] as const

export const recordCustomerPaymentSchema = z.object({
  paymentDate: z.string().min(1, 'التاريخ مطلوب'),
  amount: z.number().positive('المبلغ يجب أن يكون أكبر من الصفر'),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'check']),
  notes: z.string().trim().max(300).optional().or(z.literal(''))
})

export type RecordCustomerPaymentFormValues = z.infer<typeof recordCustomerPaymentSchema>

export const recordCustomerPaymentDefaults: RecordCustomerPaymentFormValues = {
  paymentDate: new Date().toISOString().split('T')[0],
  amount: 0,
  paymentMethod: 'cash',
  notes: ''
}
