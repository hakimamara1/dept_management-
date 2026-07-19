import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-client'
import { expirationApi } from '../services/expiration.api'

export function useExpiringReport(days: number) {
  return useQuery({
    queryKey: queryKeys.expiration.report('expiring', days),
    queryFn: () => expirationApi.getExpiringReport(days)
  })
}

export function useExpiredReport() {
  return useQuery({
    queryKey: queryKeys.expiration.report('expired'),
    queryFn: () => expirationApi.getExpiredReport()
  })
}

export function useDiscardedReport() {
  return useQuery({
    queryKey: queryKeys.expiration.report('discarded'),
    queryFn: () => expirationApi.getDiscardedReport()
  })
}
