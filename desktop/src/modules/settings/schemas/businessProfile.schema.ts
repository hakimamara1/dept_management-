import { z } from 'zod'

export const businessProfileSchema = z.object({
  businessName: z.string().trim().max(200).optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  email: z.string().trim().email('بريد إلكتروني غير صالح').optional().or(z.literal('')),
  taxNumber: z.string().trim().max(50).optional().or(z.literal('')),
  commercialRegister: z.string().trim().max(50).optional().or(z.literal(''))
})

export type BusinessProfileFormValues = z.infer<typeof businessProfileSchema>
