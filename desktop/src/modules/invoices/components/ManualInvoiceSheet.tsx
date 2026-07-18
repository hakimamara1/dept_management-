import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useFieldArray, useForm } from 'react-hook-form'
import { Camera, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Textarea } from '@shared/components/ui/textarea'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@shared/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@shared/components/ui/form'
import { ProductPicker } from '@shared/components/ProductPicker'
import { SupplierPicker } from '@shared/components/SupplierPicker'
import { queryKeys } from '@shared/lib/query-client'
import { useI18n } from '@shared/lib/i18n'
import { useCreateManualInvoice } from '../hooks/useInvoiceMutations'
import { invoicesApi } from '../services/invoices.api'
import { manualInvoiceDefaults, manualInvoiceSchema, type ManualInvoiceFormValues } from '../schemas/invoice.schema'

/**
 * For a supplier's handwritten invoice — no OCR JSON to paste, the numbers
 * are typed in directly from the paper. Lands at Pending Review exactly
 * like an OCR import (see business-rules.md), so it goes through the same
 * InvoiceItemsTable edit/approve flow from there.
 */
export function ManualInvoiceSheet() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [photos, setPhotos] = useState<File[]>([])
  const createInvoice = useCreateManualInvoice()
  const queryClient = useQueryClient()

  const form = useForm<ManualInvoiceFormValues>({
    resolver: zodResolver(manualInvoiceSchema),
    defaultValues: manualInvoiceDefaults
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })

  useEffect(() => {
    if (open) {
      form.reset(manualInvoiceDefaults)
      setPhotos([])
    }
  }, [open, form])

  // The invoiceId only exists once creation succeeds, so this takes it as a
  // mutation variable rather than a hook-level id like useAddInvoiceAttachments.
  const uploadPhotos = useMutation({
    mutationFn: ({ invoiceId, files }: { invoiceId: number; files: File[] }) =>
      invoicesApi.addAttachments(invoiceId, files),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.review(variables.invoiceId) })
    },
    onError: (error: Error) => {
      toast.error('تم إنشاء الفاتورة لكن فشل إرفاق الصور', { description: error.message })
    }
  })

  function onSubmit(values: ManualInvoiceFormValues) {
    createInvoice.mutate(
      {
        supplierId: values.supplier!.id,
        invoiceNumber: values.invoiceNumber,
        invoiceDate: values.invoiceDate,
        discount: values.discount,
        tax: values.tax,
        paymentMethod: values.paymentMethod || undefined,
        notes: values.notes || undefined,
        items: values.items.map((item) => ({
          productName: item.product!.name,
          productId: item.product!.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      },
      {
        onSuccess: (result) => {
          if (photos.length > 0) {
            uploadPhotos.mutate({ invoiceId: result.invoiceId, files: photos }, { onSettled: () => setOpen(false) })
          } else {
            setOpen(false)
          }
        }
      }
    )
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <Camera className="size-4" />
          {t('invoices.createManual')}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t('invoices.createManual')}</SheetTitle>
          <SheetDescription>
            لفاتورة ورقية مكتوبة بخط اليد — أدخل البيانات مباشرة بدل لصق نص OCR. تُحفظ في حالة "قيد المراجعة" مثل أي
            فاتورة أخرى.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-4 overflow-y-auto py-4">
            <FormField
              control={form.control}
              name="supplier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>المورد *</FormLabel>
                  <FormControl>
                    <SupplierPicker value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="invoiceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>رقم الفاتورة *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="invoiceDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>تاريخ الفاتورة *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="discount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الخصم</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="اختياري"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الضريبة</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="اختياري"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ملاحظات</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="اختياري" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <FormLabel>صور الفاتورة الورقية</FormLabel>
              <Input
                type="file"
                accept="image/*"
                multiple
                className="mt-2"
                onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
              />
              {photos.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">{photos.length} صورة محددة</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">الأصناف *</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => append({ product: null, quantity: 1, unitPrice: 0 })}
              >
                <Plus className="size-3.5" />
                إضافة صنف
              </Button>
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-2 rounded-md border border-border p-3">
                  <div className="flex-1">
                    <FormField
                      control={form.control}
                      name={`items.${index}.product`}
                      render={({ field: productField }) => (
                        <FormItem>
                          <FormLabel className="text-xs">المنتج</FormLabel>
                          <FormControl>
                            <ProductPicker
                              value={productField.value}
                              onChange={(product) => {
                                productField.onChange(product)
                                const priceFieldName = `items.${index}.unitPrice` as const
                                const currentPrice = form.getValues(priceFieldName)
                                const lastCost = product?.lastPurchasePrice ?? product?.averageCost ?? undefined
                                if (product && lastCost != null && !currentPrice) {
                                  form.setValue(priceFieldName, lastCost, { shouldDirty: true, shouldValidate: true })
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="w-24">
                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field: qtyField }) => (
                        <FormItem>
                          <FormLabel className="text-xs">الكمية</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              {...qtyField}
                              onChange={(e) => qtyField.onChange(e.target.valueAsNumber)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="w-28">
                    <FormField
                      control={form.control}
                      name={`items.${index}.unitPrice`}
                      render={({ field: priceField }) => (
                        <FormItem>
                          <FormLabel className="text-xs">السعر</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              {...priceField}
                              onChange={(e) => priceField.onChange(e.target.valueAsNumber)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            {form.formState.errors.items?.root && (
              <p className="text-xs font-medium text-destructive">{form.formState.errors.items.root.message}</p>
            )}

            <div className="mt-auto flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" disabled={createInvoice.isPending || uploadPhotos.isPending}>
                {createInvoice.isPending || uploadPhotos.isPending ? 'جاري الحفظ...' : 'حفظ'}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
