import { z } from 'zod'

// This app deliberately doesn't do OCR itself — it accepts the already-
// extracted JSON an external OCR/AI step produces (see invoice.json at the
// repo root for a real sample of the shape). Validation here checks the
// text is parseable JSON with the fields the backend requires, not the
// full invoice schema — the backend's own validationService is the source
// of truth for business rules (math checks, duplicates, etc).
export const submitInvoiceSchema = z.object({
  ocrJson: z
    .string()
    .trim()
    .min(1, 'الصق نص JSON للفاتورة')
    .superRefine((val, ctx) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(val)
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'النص المدخل ليس JSON صالحاً' })
        return
      }

      const obj = parsed as Record<string, unknown>
      if (!obj.invoice_number) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'الحقل invoice_number مطلوب' })
      }
      if (!obj.invoice_date) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'الحقل invoice_date مطلوب' })
      }
      if (!(obj.supplier as Record<string, unknown> | undefined)?.name) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'اسم المورد (supplier.name) مطلوب' })
      }
      if (!Array.isArray(obj.items) || obj.items.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'يجب أن تحتوي الفاتورة على صنف واحد على الأقل' })
      }
    })
})

export type SubmitInvoiceFormValues = z.infer<typeof submitInvoiceSchema>

export const submitInvoiceDefaults: SubmitInvoiceFormValues = { ocrJson: '' }
