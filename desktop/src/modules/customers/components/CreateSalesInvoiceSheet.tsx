import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Textarea } from '@shared/components/ui/textarea'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@shared/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@shared/components/ui/form'
import { formatCurrency } from '@shared/lib/format'
import { useI18n } from '@shared/lib/i18n'
import { useCreateSalesInvoice } from '../hooks/useCustomerMutations'
import {
  createSalesInvoiceDefaults,
  createSalesInvoiceSchema,
  type CreateSalesInvoiceFormValues
} from '../schemas/salesInvoice.schema'

export function CreateSalesInvoiceSheet({ customerId, previousBalance }: { customerId: number; previousBalance: number }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const createInvoice = useCreateSalesInvoice(customerId)

  const form = useForm<CreateSalesInvoiceFormValues>({
    resolver: zodResolver(createSalesInvoiceSchema),
    defaultValues: createSalesInvoiceDefaults
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })
  const watchedItems = form.watch('items')
  const invoiceAmount = watchedItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0
  )

  useEffect(() => {
    if (open) form.reset(createSalesInvoiceDefaults)
  }, [open, form])

  function onSubmit(values: CreateSalesInvoiceFormValues) {
    createInvoice.mutate(values, { onSuccess: () => setOpen(false) })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          {t('customers.newInvoice')}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t('customers.newInvoice')}</SheetTitle>
          <SheetDescription>الفاتورة غير قابلة للتعديل بعد الحفظ. الدفعات تُسجَّل لاحقاً بشكل منفصل.</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-4 overflow-y-auto py-4">
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

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">الأصناف *</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => append({ productName: '', unit: '', quantity: 1, unitPrice: 0 })}
              >
                <Plus className="size-3.5" />
                إضافة صنف
              </Button>
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-2 rounded-md border border-border p-3">
                  <div className="flex-[2]">
                    <FormField
                      control={form.control}
                      name={`items.${index}.productName`}
                      render={({ field: nameField }) => (
                        <FormItem>
                          <FormLabel className="text-xs">الصنف</FormLabel>
                          <FormControl>
                            <Input placeholder="اسم الصنف" {...nameField} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="w-20">
                    <FormField
                      control={form.control}
                      name={`items.${index}.unit`}
                      render={({ field: unitField }) => (
                        <FormItem>
                          <FormLabel className="text-xs">الوحدة</FormLabel>
                          <FormControl>
                            <Input placeholder="قطعة" {...unitField} />
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

            <div className="mt-auto space-y-1.5 rounded-md border border-border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>{t('customers.previousBalance')}</span>
                <span className="tabular-nums">{formatCurrency(previousBalance)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>{t('customers.invoiceAmount')}</span>
                <span className="tabular-nums">{formatCurrency(invoiceAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 font-semibold text-foreground">
                <span>{t('customers.newBalance')}</span>
                <span className="tabular-nums">{formatCurrency(previousBalance + invoiceAmount)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createInvoice.isPending}>
                {createInvoice.isPending ? t('common.loading') : t('common.create')}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
