import { api } from '@/shared/api/client'
import type { CreateExpirationBatchInput, ExpirationBatch, ExpirationBatchStatus, UpdateExpirationBatchInput } from '@desktop-types/api'

export const expiryApi = {
  /** Everything (open and closed); the screen groups by calendar date itself. */
  list: () => api.get<ExpirationBatch[]>('/api/expiration-batches'),
  create: (data: CreateExpirationBatchInput, key: string) => api.post<ExpirationBatch>('/api/expiration-batches', data, { idempotencyKey: key }),
  update: (id: number, data: UpdateExpirationBatchInput, key: string) =>
    api.patch<ExpirationBatch>(`/api/expiration-batches/${id}`, data, { idempotencyKey: key }),
  /** Only SOLD / DISCARDED / ACTIVE are user-settable; the date-derived states never are. */
  setStatus: (id: number, status: Extract<ExpirationBatchStatus, 'ACTIVE' | 'SOLD' | 'DISCARDED'>, key: string) =>
    api.patch<ExpirationBatch>(`/api/expiration-batches/${id}/status`, { status }, { idempotencyKey: key }),
  remove: (id: number, key: string) => api.delete<{ success: boolean }>(`/api/expiration-batches/${id}`, { idempotencyKey: key })
}
