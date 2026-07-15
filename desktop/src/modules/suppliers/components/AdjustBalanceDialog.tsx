import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Scale } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
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
import { useAdjustBalance } from '../hooks/useSupplierMutations'
import { adjustBalanceDefaults, adjustBalanceSchema, type AdjustBalanceFormValues } from '../schemas/supplier.schema'

export function AdjustBalanceDialog({ supplierId }: { supplierId: number }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const adjustBalance = useAdjustBalance(supplierId)

  const form = useForm<AdjustBalanceFormValues>({
    resolver: zodResolver(adjustBalanceSchema),
    defaultValues: adjustBalanceDefaults
  })

  useEffect(() => {
    if (open) form.reset(adjustBalanceDefaults)
  }, [open, form])

  function onSubmit(values: AdjustBalanceFormValues) {
    adjustBalance.mutate(values, { onSuccess: () => setOpen(false) })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Scale className="size-4" />
          {t('suppliers.adjustBalance')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('suppliers.adjustBalance')}</DialogTitle>
          <DialogDescription>لتصحيح الأخطاء أو تسجيل خصومات لا ترتبط بفاتورة أو دفعة. قيمة موجبة تزيد الدين، وقيمة سالبة تنقصه.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>قيمة التسوية *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="مثال: -500 أو 500"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>السبب *</FormLabel>
                  <FormControl>
                    <Input placeholder="مثال: تصحيح خطأ إدخال، خصم متفق عليه..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={adjustBalance.isPending || !form.formState.isDirty}>
                {adjustBalance.isPending ? t('common.loading') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
