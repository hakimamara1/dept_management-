import { useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Download, Upload } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@shared/components/ui/form'
import { Card, CardContent } from '@shared/components/ui/card'
import { PageHeader } from '@shared/components/PageHeader'
import { LoadingState } from '@shared/components/LoadingState'
import { API_BASE_URL } from '@shared/lib/api-client'
import { formatDate } from '@shared/lib/format'
import { useBusinessProfile } from '../hooks/useBusinessProfile'
import { useDownloadBackup, useRestoreBackup, useUpdateBusinessProfile, useUploadLogo } from '../hooks/useSettingsMutations'
import { businessProfileSchema, type BusinessProfileFormValues } from '../schemas/businessProfile.schema'

type SubTab = 'profile' | 'backup'

function BusinessProfileTab() {
  const { data: profile, isLoading } = useBusinessProfile()
  const updateProfile = useUpdateBusinessProfile()
  const uploadLogo = useUploadLogo()
  const logoInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<BusinessProfileFormValues>({
    resolver: zodResolver(businessProfileSchema),
    defaultValues: {
      businessName: '',
      address: '',
      phone: '',
      email: '',
      taxNumber: '',
      commercialRegister: ''
    }
  })

  useEffect(() => {
    if (!profile) return
    form.reset({
      businessName: profile.business_name ?? '',
      address: profile.address ?? '',
      phone: profile.phone ?? '',
      email: profile.email ?? '',
      taxNumber: profile.tax_number ?? '',
      commercialRegister: profile.commercial_register ?? ''
    })
  }, [profile, form])

  function onSubmit(values: BusinessProfileFormValues) {
    updateProfile.mutate(values)
  }

  function handleLogoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadLogo.mutate(file)
    e.target.value = ''
  }

  if (isLoading) return <LoadingState rows={4} />

  return (
    <Card>
      <CardContent className="space-y-6 p-5">
        <div className="flex items-center gap-4">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
            {profile?.logo_path ? (
              <img src={`${API_BASE_URL}/uploads/${profile.logo_path}`} alt="شعار الشركة" className="size-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">لا شعار</span>
            )}
          </div>
          <div>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelected} />
            <Button type="button" variant="outline" size="sm" disabled={uploadLogo.isPending} onClick={() => logoInputRef.current?.click()}>
              <Upload className="size-3.5" />
              {uploadLogo.isPending ? 'جاري الرفع...' : 'رفع شعار'}
            </Button>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="businessName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم الشركة</FormLabel>
                  <FormControl>
                    <Input placeholder="اختياري" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
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
                control={form.control}
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
                control={form.control}
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
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
                control={form.control}
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

            <div className="flex justify-end">
              <Button type="submit" disabled={updateProfile.isPending || !form.formState.isDirty}>
                {updateProfile.isPending ? 'جاري الحفظ...' : 'حفظ'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

function DataBackupTab() {
  const { data: profile } = useBusinessProfile()
  const downloadBackup = useDownloadBackup()
  const restoreBackup = useRestoreBackup()
  const restoreInputRef = useRef<HTMLInputElement>(null)

  function handleRestoreSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (
      !window.confirm(
        'استعادة نسخة احتياطية تستبدل بيانات التطبيق الحالية. البيانات الحالية تُحفظ تلقائياً كنسخة احتياطية جانبية ولا تُحذف، لكن يجب إعادة تشغيل التطبيق بعد الاستعادة لتفعيلها. المتابعة؟'
      )
    ) {
      return
    }
    restoreBackup.mutate(file)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="text-sm font-medium">نسخة احتياطية</div>
          <p className="text-sm text-muted-foreground">
            تنزيل نسخة كاملة من قاعدة بيانات التطبيق — يمكن استخدامها للاستعادة لاحقاً أو الاحتفاظ بها كأرشيف.
          </p>
          <Button type="button" onClick={() => downloadBackup.mutate()} disabled={downloadBackup.isPending}>
            <Download className="size-4" />
            {downloadBackup.isPending ? 'جاري التنزيل...' : 'تنزيل نسخة احتياطية'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="text-sm font-medium">استعادة من نسخة احتياطية</div>
          <p className="text-sm text-muted-foreground">
            استبدال بيانات التطبيق الحالية بملف نسخة احتياطية سابق (.db). البيانات الحالية تُحفظ جانباً تلقائياً، ولا
            تُحذف — لكن التغيير يتطلب إعادة تشغيل التطبيق ليأخذ مفعوله.
          </p>
          <input ref={restoreInputRef} type="file" accept=".db" className="hidden" onChange={handleRestoreSelected} />
          <Button
            type="button"
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={restoreBackup.isPending}
            onClick={() => restoreInputRef.current?.click()}
          >
            <Upload className="size-4" />
            {restoreBackup.isPending ? 'جاري الاستعادة...' : 'استعادة من نسخة احتياطية'}
          </Button>
        </CardContent>
      </Card>

      {profile && (
        <p className="text-xs text-muted-foreground">آخر تحديث لبيانات الشركة: {formatDate(profile.updated_at)}</p>
      )}
    </div>
  )
}

export function SettingsPage() {
  const [tab, setTab] = useState<SubTab>('profile')

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="الإعدادات" subtitle="بيانات الشركة والنسخ الاحتياطي" />

      <div className="mb-4 flex gap-2">
        <Button variant={tab === 'profile' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('profile')}>
          ملف الشركة
        </Button>
        <Button variant={tab === 'backup' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('backup')}>
          النسخ الاحتياطي
        </Button>
      </div>

      {tab === 'profile' && <BusinessProfileTab />}
      {tab === 'backup' && <DataBackupTab />}
    </div>
  )
}
