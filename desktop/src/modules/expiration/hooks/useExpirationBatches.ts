import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-client'
import type { ExpirationBatchFilters } from '@shared/types/api'
import { expirationApi } from '../services/expiration.api'

export function useExpirationBatches(filters: ExpirationBatchFilters = {}) {
  return useQuery({
    queryKey: queryKeys.expiration.list(filters as Record<string, unknown>),
    queryFn: () => expirationApi.getAll(filters)
  })
}

export function useExpirationBatch(id: number) {
  return useQuery({
    queryKey: queryKeys.expiration.detail(id),
    queryFn: () => expirationApi.getById(id),
    enabled: Number.isFinite(id)
  })
}

export function useExpirationDashboard() {
  return useQuery({
    queryKey: queryKeys.expiration.dashboard,
    queryFn: () => expirationApi.getDashboardSummary()
  })
}
