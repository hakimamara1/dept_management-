import { z } from 'zod'

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'نقداً' },
  { value: 'bank_transfer', label: 'تحويل بنكي' },
  { value: 'check', label: 'شيك' }
] as const

export const recordPaymentSchema = z.object({
  amount: z.number().positive('المبلغ يجب أن يكون أكبر من الصفر'),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'check']),
  reference: z.string().trim().max(100).optional().or(z.literal('')),
  notes: z.string().trim().max(300).optional().or(z.literal('')),
  date: z.string().min(1, 'التاريخ مطلوب')
})

export type RecordPaymentFormValues = z.infer<typeof recordPaymentSchema>

export const recordPaymentDefaults: RecordPaymentFormValues = {
  amount: 0,
  paymentMethod: 'cash',
  reference: '',
  notes: '',
  date: new Date().toISOString().split('T')[0]
}

export const adjustBalanceSchema = z.object({
  amount: z.number().refine((v) => v !== 0, 'قيمة التسوية لا يمكن أن تكون صفراً'),
  reason: z.string().trim().min(1, 'سبب التسوية مطلوب').max(300)
})

export type AdjustBalanceFormValues = z.infer<typeof adjustBalanceSchema>

export const adjustBalanceDefaults: AdjustBalanceFormValues = {
  amount: 0,
  reason: ''
}
