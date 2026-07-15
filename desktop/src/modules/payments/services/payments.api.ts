import { apiClient } from '@shared/lib/api-client'
import type { RecordPaymentInput, SupplierTransaction } from '@shared/types/api'

export const paymentsApi = {
  getAll: () => apiClient.get<SupplierTransaction[]>('/api/payments'),
  record: (supplierId: number, data: RecordPaymentInput) =>
    apiClient.post(`/api/suppliers/${supplierId}/payments`, data)
}
