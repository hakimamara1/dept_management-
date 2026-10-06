import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Plus } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@shared/components/ui/dialog'
import { Form } from '@shared/components/ui/form'
import { useI18n } from '@shared/lib/i18n'
import { useCreateSupplier } from '../hooks/useSupplierMutations'
import { SupplierFormFields } from './SupplierFormFields'
import { createSupplierDefaults, createSupplierSchema, type CreateSupplierFormValues } from '../schemas/supplier.schema'

export function CreateSupplierDialog() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const createSupplier = useCreateSupplier()

  const form = useForm<CreateSupplierFormValues>({
    resolver: zodResolver(createSupplierSchema),
    defaultValues: createSupplierDefaults
  })

  useEffect(() => {
    if (open) form.reset(createSupplierDefaults)
  }, [open, form])

  function onSubmit(values: CreateSupplierFormValues) {
    createSupplier.mutate(values, { onSuccess: () => setOpen(false) })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          إضافة مورد
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة مورد</DialogTitle>
          <DialogDescription>سيتم إضافة المورد برصيد صفر — يمكن تسجيل الفواتير والدفعات عليه لاحقاً.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <SupplierFormFields control={form.control} />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createSupplier.isPending || !form.formState.isDirty}>
                {createSupplier.isPending ? t('common.loading') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
