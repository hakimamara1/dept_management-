import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Textarea } from '@shared/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@shared/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@shared/components/ui/form'
import type { ExpirationBatch } from '@shared/types/api'
import { useUpdateExpirationBatch } from '../hooks/useExpirationMutations'
import { editBatchSchema, type EditBatchFormValues } from '../schemas/batch.schema'

interface EditBatchDialogProps {
  batch: ExpirationBatch | null
  onOpenChange: (open: boolean) => void
}

function defaultsFrom(batch: ExpirationBatch): EditBatchFormValues {
  return {
    batchNumber: batch.batch_number,
    manufacturingDate: batch.manufacturing_date ?? '',
    expirationDate: batch.expiration_date,
    quantity: batch.quantity ?? undefined,
    unit: batch.unit ?? '',
    location: batch.location ?? '',
    notes: batch.notes ?? ''
  }
}

/** Batch number/dates/quantity/location/notes only — the product cannot be changed after creation. */
export function EditBatchDialog({ batch, onOpenChange }: EditBatchDialogProps) {
  const updateBatch = useUpdateExpirationBatch(batch?.id ?? 0)

  const form = useForm<EditBatchFormValues>({
    resolver: zodResolver(editBatchSchema),
    defaultValues: batch ? defaultsFrom(batch) : undefined
  })

  useEffect(() => {
    if (batch) form.reset(defaultsFrom(batch))
  }, [batch, form])

  function onSubmit(values: EditBatchFormValues) {
    updateBatch.mutate(
      {
        batchNumber: values.batchNumber,
        expirationDate: values.expirationDate,
        manufacturingDate: values.manufacturingDate || undefined,
        quantity: values.quantity,
        unit: values.unit || undefined,
        location: values.location || undefined,
        notes: values.notes || undefined
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog open={batch != null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعديل الدفعة</DialogTitle>
          <DialogDescription>{batch?.product_name}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="batchNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>رقم الدفعة *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="manufacturingDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>تاريخ التصنيع</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expirationDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>تاريخ انتهاء الصلاحية *</FormLabel>
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
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الكمية</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
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
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الموقع</FormLabel>
                    <FormControl>
                      <Input placeholder="اختياري" {...field} />
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

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button type="submit" disabled={updateBatch.isPending}>
                {updateBatch.isPending ? 'جاري الحفظ...' : 'حفظ'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
