import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Upload } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Textarea } from '@shared/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@shared/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@shared/components/ui/form'
import { useI18n } from '@shared/lib/i18n'
import { useSubmitInvoice } from '../hooks/useInvoiceMutations'
import { submitInvoiceDefaults, submitInvoiceSchema, type SubmitInvoiceFormValues } from '../schemas/invoice.schema'

export function SubmitInvoiceDialog() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const submitInvoice = useSubmitInvoice()

  const form = useForm<SubmitInvoiceFormValues>({
    resolver: zodResolver(submitInvoiceSchema),
    defaultValues: submitInvoiceDefaults
  })

  useEffect(() => {
    if (open) form.reset(submitInvoiceDefaults)
  }, [open, form])

  function onSubmit(values: SubmitInvoiceFormValues) {
    const ocrJson = JSON.parse(values.ocrJson)
    submitInvoice.mutate(ocrJson, { onSuccess: () => setOpen(false) })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Upload className="size-4" />
          {t('invoices.submitInvoice')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('invoices.submitInvoice')}</DialogTitle>
          <DialogDescription>
            الصق نص JSON الناتج عن استخراج الفاتورة (OCR) — هذا النظام لا يقوم باستخراج النص من الصور بنفسه، بل يستقبل الناتج الجاهز.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="ocrJson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نص JSON</FormLabel>
                  <FormControl>
                    <Textarea
                      dir="ltr"
                      rows={12}
                      placeholder='{"invoice_number": "1403", "invoice_date": "15/06/2026", "supplier": {"name": "..."}, "items": [...]}'
                      className="font-mono text-xs"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={submitInvoice.isPending || !form.formState.isDirty}>
                {submitInvoice.isPending ? t('common.loading') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
