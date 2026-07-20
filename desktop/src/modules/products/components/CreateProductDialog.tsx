import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Plus } from 'lucide-react'
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@shared/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { useI18n } from '@shared/lib/i18n'
import type { PickedProduct } from '@shared/components/ProductPicker'
import { useCreateProduct } from '../hooks/useCreateProduct'
import { PRODUCT_UNITS, productFormDefaults, productSchema, type ProductFormValues } from '../schemas/product.schema'

interface CreateProductDialogProps {
  /** Controlled mode (e.g. opened from another screen's "no results" action). Omit for the default self-contained button+dialog. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Prefills the name field — typically the free text the user already typed elsewhere. */
  defaultName?: string
  /** Fires after a successful create, with enough of the new product to drop straight into a picker's selected value. */
  onCreated?: (product: PickedProduct) => void
  /** Set to false when opened externally (controlled mode) to skip rendering the built-in trigger button. Defaults to true. */
  trigger?: boolean
}

export function CreateProductDialog({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  defaultName,
  onCreated,
  trigger = true
}: CreateProductDialogProps = {}) {
  const { t } = useI18n()
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = setControlledOpen ?? setUncontrolledOpen
  const createProduct = useCreateProduct()

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: productFormDefaults
  })

  // Reset the form (and its dirty state) every time the dialog is reopened.
  useEffect(() => {
    if (open) form.reset({ ...productFormDefaults, name: defaultName ?? '' })
  }, [open, defaultName, form])

  function onSubmit(values: ProductFormValues) {
    createProduct.mutate(values, {
      onSuccess: (result) => {
        setOpen(false)
        onCreated?.({ id: result.id, name: values.name, unit: values.unit, defaultSalePrice: values.defaultSalePrice })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="size-4" />
            {t('products.addProduct')}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('products.addProduct')}</DialogTitle>
          <DialogDescription>سيتم إضافة المنتج إلى الكتالوج ليصبح متاحاً للمطابقة التلقائية.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم المنتج *</FormLabel>
                  <FormControl>
                    <Input placeholder="مثال: زيت الكابتن 250ml" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الباركود</FormLabel>
                    <FormControl>
                      <Input placeholder="اختياري" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الفئة</FormLabel>
                    <FormControl>
                      <Input placeholder="مثال: زيوت، توابل..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الوحدة</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PRODUCT_UNITS.map((u) => (
                        <SelectItem key={u.value} value={u.value}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="defaultSalePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>سعر البيع المقترح</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="اختياري"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.valueAsNumber)}
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
              <Button type="submit" disabled={createProduct.isPending || !form.formState.isDirty}>
                {createProduct.isPending ? t('common.loading') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
