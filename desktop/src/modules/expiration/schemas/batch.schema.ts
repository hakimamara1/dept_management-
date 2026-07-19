import { z } from 'zod'

const pickedRef = z.object({ id: z.number(), name: z.string() })

// Product + batch number + expiration date are the only required fields —
// everything else is optional per the spec. Product is only present on the
// create schema; it can never be changed once a batch exists.
const baseBatchFields = {
  batchNumber: z.string().trim().min(1, 'رقم الدفعة مطلوب').max(100),
  manufacturingDate: z.string().optional().or(z.literal('')),
  expirationDate: z.string().min(1, 'تاريخ انتهاء الصلاحية مطلوب'),
  quantity: z.number().min(0).optional(),
  unit: z.string().trim().max(20).optional().or(z.literal('')),
  location: z.string().trim().max(200).optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal(''))
}

function checkDates(data: { manufacturingDate?: string; expirationDate: string }, ctx: z.RefinementCtx) {
  if (data.manufacturingDate && data.expirationDate && data.expirationDate < data.manufacturingDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'تاريخ انتهاء الصلاحية يجب أن يكون بعد تاريخ التصنيع',
      path: ['expirationDate']
    })
  }
}

export const createBatchSchema = z
  .object({ product: pickedRef.nullable(), ...baseBatchFields })
  .superRefine((data, ctx) => {
    if (!data.product) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'اختر منتجاً', path: ['product'] })
    }
    checkDates(data, ctx)
  })

export type CreateBatchFormValues = z.infer<typeof createBatchSchema>

export const createBatchDefaults: CreateBatchFormValues = {
  product: null,
  batchNumber: '',
  manufacturingDate: '',
  expirationDate: '',
  quantity: undefined,
  unit: '',
  location: '',
  notes: ''
}

export const editBatchSchema = z.object(baseBatchFields).superRefine(checkDates)
export type EditBatchFormValues = z.infer<typeof editBatchSchema>
