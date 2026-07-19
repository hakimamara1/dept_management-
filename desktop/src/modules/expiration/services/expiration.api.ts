import { apiClient } from '@shared/lib/api-client'
import type {
  CreateExpirationBatchInput,
  ExpirationBatch,
  ExpirationBatchFilters,
  ExpirationBatchStatus,
  ExpirationDashboardSummary,
  UpdateExpirationBatchInput
} from '@shared/types/api'

function buildQuery(filters: ExpirationBatchFilters): string {
  const params = new URLSearchParams()
  if (filters.productId) params.set('productId', String(filters.productId))
  if (filters.category) params.set('category', filters.category)
  if (filters.status) params.set('status', filters.status)
  if (filters.expiringWithinDays != null) params.set('expiringWithinDays', String(filters.expiringWithinDays))
  if (filters.search) params.set('search', filters.search)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const expirationApi = {
  getAll: (filters: ExpirationBatchFilters = {}) =>
    apiClient.get<ExpirationBatch[]>(`/api/expiration-batches${buildQuery(filters)}`),
  getById: (id: number) => apiClient.get<ExpirationBatch>(`/api/expiration-batches/${id}`),
  getDashboardSummary: () => apiClient.get<ExpirationDashboardSummary>('/api/expiration-batches/dashboard-summary'),
  getExpiringReport: (days: number) =>
    apiClient.get<ExpirationBatch[]>(`/api/expiration-batches/reports/expiring?days=${days}`),
  getExpiredReport: () => apiClient.get<ExpirationBatch[]>('/api/expiration-batches/reports/expired'),
  getDiscardedReport: () => apiClient.get<ExpirationBatch[]>('/api/expiration-batches/reports/discarded'),
  create: (data: CreateExpirationBatchInput) => apiClient.post<ExpirationBatch>('/api/expiration-batches', data),
  update: (id: number, data: UpdateExpirationBatchInput) =>
    apiClient.patch<ExpirationBatch>(`/api/expiration-batches/${id}`, data),
  setStatus: (id: number, status: ExpirationBatchStatus) =>
    apiClient.patch<ExpirationBatch>(`/api/expiration-batches/${id}/status`, { status }),
  delete: (id: number) => apiClient.delete<{ success: boolean }>(`/api/expiration-batches/${id}`)
}
