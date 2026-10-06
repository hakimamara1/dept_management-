import { apiClient } from '@shared/lib/api-client'
import type { PaymentAnalytics, PaymentFilters, RecordPaymentInput, SupplierTransaction } from '@shared/types/api'

function filterQuery({ range, from, to, supplierId }: PaymentFilters): string {
  const params = new URLSearchParams({ range })
  if (range === 'custom') {
    if (from) params.set('from', from)
    if (to) params.set('to', to)
  }
  if (supplierId) params.set('supplierId', String(supplierId))
  return params.toString()
}

export const paymentsApi = {
  getAll: (filters: PaymentFilters) => apiClient.get<SupplierTransaction[]>(`/api/payments?${filterQuery(filters)}`),
  getAnalytics: (filters: PaymentFilters) =>
    apiClient.get<PaymentAnalytics>(`/api/payments/analytics?${filterQuery(filters)}`),
  record: (supplierId: number, data: RecordPaymentInput) =>
    apiClient.post(`/api/suppliers/${supplierId}/payments`, data)
}
