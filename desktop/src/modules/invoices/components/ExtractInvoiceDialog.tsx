import { useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@shared/components/ui/dialog'
import { useI18n } from '@shared/lib/i18n'
import { useExtractInvoice } from '../hooks/useInvoiceMutations'

/**
 * Upload a photo of the invoice — an AI model (Replicate/Gemini) extracts
 * the data server-side (see aiExtractionService.js), which then lands at
 * Pending Review exactly like any other import. Replaces the old
 * paste-OCR-JSON dialog entirely.
 */
export function ExtractInvoiceDialog() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const extractInvoice = useExtractInvoice()

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) setFile(null)
  }

  function handleSubmit() {
    if (!file) return
    extractInvoice.mutate(file, { onSuccess: () => setOpen(false) })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Upload className="size-4" />
          {t('invoices.submitInvoice')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('invoices.submitInvoice')}</DialogTitle>
          <DialogDescription>
            صوّر أو اختر صورة الفاتورة — الذكاء الاصطناعي يستخرج البيانات تلقائياً وتصبح الفاتورة جاهزة للمراجعة.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="invoice-photo">صورة الفاتورة</Label>
          <Input
            id="invoice-photo"
            type="file"
            accept="image/*"
            disabled={extractInvoice.isPending}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {extractInvoice.isPending && (
          <p className="text-sm text-muted-foreground">جاري تحليل الفاتورة بالذكاء الاصطناعي... قد يستغرق ذلك بضع ثوانٍ.</p>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={extractInvoice.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!file || extractInvoice.isPending}>
            {extractInvoice.isPending ? 'جاري الاستخراج...' : 'رفع واستخراج'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
