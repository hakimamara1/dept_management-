import { Smartphone, Trash2, Wifi } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Badge } from '@shared/components/ui/badge'
import { Card, CardContent } from '@shared/components/ui/card'
import { LoadingState } from '@shared/components/LoadingState'
import { ErrorState } from '@shared/components/ErrorState'
import { formatDate } from '@shared/lib/format'
import { useMobileDevices, useMobileStatus, useRevokeDevice, useToggleMobileAccess } from '../hooks/useMobileAccess'
import { PairPhoneDialog } from './PairPhoneDialog'

function timeAgo(value: string | null) {
  if (!value) return '—'
  // SQLite CURRENT_TIMESTAMP is UTC without a zone marker.
  const ms = Date.now() - new Date(`${value.replace(' ', 'T')}Z`).getTime()
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) return 'الآن'
  if (minutes < 60) return `منذ ${minutes} دقيقة`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `منذ ${hours} ساعة`
  return formatDate(value)
}

export function MobileAccessTab() {
  const status = useMobileStatus()
  const devices = useMobileDevices()
  const toggle = useToggleMobileAccess()
  const revoke = useRevokeDevice()

  if (status.isLoading) return <LoadingState rows={3} />
  if (status.error || !status.data) {
    return <ErrorState message={status.error?.message ?? 'تعذّر تحميل الحالة'} onRetry={() => status.refetch()} />
  }
  const s = status.data

  function handleRevoke(id: number, name: string) {
    if (!window.confirm(`فصل الجهاز «${name}»؟ لن يتمكن من الاتصال إلا بعد اقتران جديد.`)) return
    revoke.mutate(id)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <Wifi className="size-4" />
                الاتصال بالهاتف عبر الشبكة المحلية
                <Badge variant={s.running ? 'success' : 'secondary'}>{s.running ? 'مفعّل' : 'متوقف'}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                يسمح لتطبيق الهاتف بالاتصال بهذا الجهاز عبر الواي فاي (نفس المودم). يعمل فقط أثناء تشغيل البرنامج، ولا
                يُسمح إلا للهواتف المقترنة.
              </p>
            </div>
            <Button
              variant={s.enabled ? 'outline' : 'default'}
              onClick={() => toggle.mutate(!s.enabled)}
              disabled={toggle.isPending}
            >
              {toggle.isPending ? 'جاري التنفيذ...' : s.enabled ? 'إيقاف' : 'تفعيل'}
            </Button>
          </div>

          {s.running && (
            <dl className="grid grid-cols-1 gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">العنوان على الشبكة</dt>
                <dd className="tabular-nums font-medium" dir="ltr">
                  {s.hosts.length ? s.hosts.map((h) => `${h.address}:${s.port}`).join(' · ') : 'لا توجد شبكة متصلة'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">الاكتشاف التلقائي</dt>
                <dd className="font-medium">{s.discovery ? 'يعمل — الهاتف يجد الجهاز تلقائياً' : 'غير متاح — استخدم رمز QR'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">اسم الجهاز</dt>
                <dd className="font-medium">{s.desktopName}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Smartphone className="size-4" />
              الهواتف المقترنة
            </div>
            <PairPhoneDialog status={s} />
          </div>

          {devices.isLoading ? (
            <LoadingState rows={2} />
          ) : !devices.data || devices.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {s.running ? 'لا توجد هواتف مقترنة بعد — اضغط «إضافة هاتف» وامسح الرمز.' : 'فعّل الاتصال أولاً ثم أضف هاتفاً.'}
            </p>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {devices.data.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div>
                    <div className="text-sm font-medium text-foreground">{d.name}</div>
                    <div className="text-xs text-muted-foreground">
                      آخر ظهور: {timeAgo(d.last_seen_at)} · اقترن في {formatDate(d.created_at)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRevoke(d.id, d.name)}
                    disabled={revoke.isPending}
                  >
                    <Trash2 className="size-4" />
                    فصل
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
