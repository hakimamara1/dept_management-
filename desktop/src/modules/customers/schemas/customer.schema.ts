import { z } from 'zod'

export const createCustomerSchema = z.object({
  fullName: z.string().trim().min(1, 'اسم العميل مطلوب').max(200, 'الاسم طويل جداً'),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
  notes: z.string().trim().max(300).optional().or(z.literal(''))
})

export type CreateCustomerFormValues = z.infer<typeof createCustomerSchema>

export const createCustomerDefaults: CreateCustomerFormValues = {
  fullName: '',
  phone: '',
  address: '',
  notes: ''
}
