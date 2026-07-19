import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useExpirationDashboard } from './useExpirationBatches'

/**
 * "Notify on app start" for expiration tracking — this app has no push-
 * notification or background-job infrastructure, so the closest honest
 * shape is: check once when the shell mounts (which happens exactly once
 * per app launch) and toast if there's something to flag. The ref guard
 * stops it from re-firing on every background refetch of the same query.
 */
export function useExpirationStartupAlerts() {
  const { data } = useExpirationDashboard()
  const firedRef = useRef(false)

  useEffect(() => {
    if (!data || firedRef.current) return
    firedRef.current = true

    if (data.near_expiry_count > 0) {
      toast.warning(`⚠ ${data.near_expiry_count} دفعة تنتهي صلاحيتها خلال 30 يوماً`)
    }
    if (data.expired_count > 0) {
      toast.error(`❌ ${data.expired_count} دفعة منتهية الصلاحية`)
    }
  }, [data])
}
