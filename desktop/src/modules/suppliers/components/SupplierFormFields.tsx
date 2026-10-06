import type { Control } from 'react-hook-form'
import { Input } from '@shared/components/ui/input'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@shared/components/ui/form'
import type { CreateSupplierFormValues } from '../schemas/supplier.schema'

/** The supplier detail fields, shared by the create and edit dialogs. */
export function SupplierFormFields({ control }: { control: Control<CreateSupplierFormValues> }) {
  return (
    <>
      <FormField
        control={control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>اسم المورد *</FormLabel>
            <FormControl>
              <Input placeholder="مثال: أسواق مزارع سارة" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>الهاتف</FormLabel>
              <FormControl>
                <Input placeholder="اختياري" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>البريد الإلكتروني</FormLabel>
              <FormControl>
                <Input placeholder="اختياري" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="address"
        render={({ field }) => (
          <FormItem>
            <FormLabel>العنوان</FormLabel>
            <FormControl>
              <Input placeholder="اختياري" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name="taxNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>الرقم الضريبي</FormLabel>
              <FormControl>
                <Input placeholder="اختياري" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="commercialRegister"
          render={({ field }) => (
            <FormItem>
              <FormLabel>السجل التجاري</FormLabel>
              <FormControl>
                <Input placeholder="اختياري" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  )
}
