import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Pencil } from 'lucide-react'
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
import type { Supplier } from '@shared/types/api'
import { useUpdateSupplier } from '../hooks/useSupplierMutations'
import { createSupplierSchema, type CreateSupplierFormValues } from '../schemas/supplier.schema'
import { SupplierFormFields } from './SupplierFormFields'

function toFormValues(supplier: Supplier): CreateSupplierFormValues {
  return {
    name: supplier.name,
    phone: supplier.phone ?? '',
    email: supplier.email ?? '',
    address: supplier.address ?? '',
    taxNumber: supplier.tax_number ?? '',
    commercialRegister: supplier.commercial_register ?? ''
  }
}

/**
 * Edits a supplier's identity/contact details. The balance is never touched
 * here — it only moves through payments, invoices and adjustments.
 * `iconOnly` renders the compact pencil used in the suppliers list.
 */
export function EditSupplierDialog({ supplier, iconOnly = false }: { supplier: Supplier; iconOnly?: boolean }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const updateSupplier = useUpdateSupplier(supplier.id)

  const form = useForm<CreateSupplierFormValues>({
    resolver: zodResolver(createSupplierSchema),
    defaultValues: toFormValues(supplier)
  })

  useEffect(() => {
    if (open) form.reset(toFormValues(supplier))
  }, [open, supplier, form])

  function onSubmit(values: CreateSupplierFormValues) {
    updateSupplier.mutate(values, { onSuccess: () => setOpen(false) })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {iconOnly ? (
          <Button size="icon" variant="ghost" className="size-8" aria-label="تعديل المورد">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button size="sm" variant="outline">
            <Pencil className="size-4" />
            تعديل المعلومات
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعديل معلومات المورد</DialogTitle>
          <DialogDescription>تغيير الاسم لا يؤثر على الفواتير أو الرصيد — كلها مرتبطة بالمورد نفسه.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <SupplierFormFields control={form.control} />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={updateSupplier.isPending || !form.formState.isDirty}>
                {updateSupplier.isPending ? t('common.loading') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
