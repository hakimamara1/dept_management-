import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Textarea } from '@shared/components/ui/textarea'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@shared/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@shared/components/ui/form'
import { ProductPicker } from '@shared/components/ProductPicker'
import { SupplierPicker } from '@shared/components/SupplierPicker'
import { useI18n } from '@shared/lib/i18n'
import { useCreatePurchaseOrder } from '../hooks/usePurchaseOrderMutations'
import {
  createPurchaseOrderDefaults,
  createPurchaseOrderSchema,
  type CreatePurchaseOrderFormValues
} from '../schemas/purchaseOrder.schema'

export function CreatePOSheet() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const createOrder = useCreatePurchaseOrder()

  const form = useForm<CreatePurchaseOrderFormValues>({
    resolver: zodResolver(createPurchaseOrderSchema),
    defaultValues: createPurchaseOrderDefaults
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })

  useEffect(() => {
    if (open) form.reset(createPurchaseOrderDefaults)
  }, [open, form])

  function onSubmit(values: CreatePurchaseOrderFormValues) {
    createOrder.mutate(
      {
        supplierId: values.supplier!.id,
        orderDate: values.orderDate,
        expectedDate: values.expectedDate || undefined,
        notes: values.notes || undefined,
        items: values.items.map((item) => ({
          productId: item.product!.id,
          quantity: item.quantity,
          expectedUnitPrice: item.expectedUnitPrice
        }))
      },
      { onSuccess: () => setOpen(false) }
    )
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          {t('purchaseOrders.newOrder')}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t('purchaseOrders.newOrder')}</SheetTitle>
          <SheetDescription>
            أمر الشراء سجل نوايا فقط — لا يؤثر على المخزون أو الديون؛ تلك الآثار تحدث عند وصول الفاتورة الفعلية.
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
                name="orderDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>تاريخ الطلب *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expectedDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>التاريخ المتوقع للاستلام</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">الأصناف *</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => append({ product: null, quantity: 1, expectedUnitPrice: undefined })}
              >
                <Plus className="size-3.5" />
                {t('purchaseOrders.addItem')}
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

                                // Default the expected price to this product's last purchase
                                // cost — the user can still overwrite it freely afterward.
                                const priceFieldName = `items.${index}.expectedUnitPrice` as const
                                const currentPrice = form.getValues(priceFieldName)
                                const lastCost = product?.lastPurchasePrice ?? product?.averageCost ?? undefined

                                if (product && lastCost != null && (currentPrice == null || Number.isNaN(currentPrice))) {
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
                      name={`items.${index}.expectedUnitPrice`}
                      render={({ field: priceField }) => (
                        <FormItem>
                          <FormLabel className="text-xs">السعر المتوقع</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              {...priceField}
                              value={priceField.value ?? ''}
                              onChange={(e) =>
                                priceField.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)
                              }
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
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createOrder.isPending}>
                {createOrder.isPending ? t('common.loading') : t('common.create')}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
