import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { QrCode, RefreshCw } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@shared/components/ui/dialog'
import type { MobileStatus } from '@shared/types/api'
import { useCreatePairingCode, useMobileDevices } from '../hooks/useMobileAccess'

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Shows a one-time QR code the phone scans to pair. The code is single-use and
 * expires in 5 minutes, so the dialog counts down, lets the owner regenerate,
 * and closes itself as soon as a new phone shows up in the device list.
 */
export function PairPhoneDialog({ status }: { status: MobileStatus }) {
  const [open, setOpen] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const createCode = useCreatePairingCode()
  const devices = useMobileDevices(open ? 2_000 : false)
  const knownDevices = useRef<number | null>(null)

  function generate() {
    createCode.mutate(undefined, {
      onSuccess: async (code) => {
        setQr(await QRCode.toDataURL(code.payload, { width: 280, margin: 1, errorCorrectionLevel: 'M' }))
        setExpiresAt(new Date(code.expiresAt).getTime())
      }
    })
  }

  useEffect(() => {
    if (open) {
      knownDevices.current = null
      generate()
    } else {
      setQr(null)
      setExpiresAt(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [open])

  // A new device appearing while the QR is on screen means pairing succeeded.
  useEffect(() => {
    if (!open || !devices.data) return
    if (knownDevices.current == null) {
      knownDevices.current = devices.data.length
    } else if (devices.data.length > knownDevices.current) {
      setOpen(false)
    }
  }, [devices.data, open])

  const remaining = expiresAt ? expiresAt - now : 0
  const expired = expiresAt != null && remaining <= 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={!status.running}>
          <QrCode className="size-4" />
          إضافة هاتف
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>اقتران هاتف جديد</DialogTitle>
          <DialogDescription>
            افتح تطبيق Spice ERP على الهاتف (متصل بنفس شبكة الواي فاي) وامسح الرمز. الرمز لمرة واحدة وصالح 5 دقائق.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          <div className="flex size-[300px] items-center justify-center rounded-lg border border-border bg-white p-2">
            {qr && !expired ? (
              <img src={qr} alt="رمز الاقتران" className="size-[280px]" />
            ) : (
              <span className="px-6 text-center text-sm text-neutral-500">
                {createCode.isPending ? 'جاري إنشاء الرمز...' : expired ? 'انتهت صلاحية الرمز' : ''}
              </span>
            )}
          </div>

          {expiresAt && !expired && (
            <p className="text-xs text-muted-foreground tabular-nums">ينتهي خلال {formatRemaining(remaining)}</p>
          )}

          <Button type="button" variant="outline" size="sm" onClick={generate} disabled={createCode.isPending}>
            <RefreshCw className="size-3.5" />
            رمز جديد
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            العنوان على الشبكة: {status.hosts.map((h) => `${h.address}:${status.port}`).join(' · ') || '—'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
