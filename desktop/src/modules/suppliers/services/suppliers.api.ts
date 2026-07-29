import { apiClient } from '@shared/lib/api-client'
import type {
  AdjustBalanceInput,
  RecordPaymentInput,
  Supplier,
  SupplierAging,
  SupplierTransaction
} from '@shared/types/api'
import type { CreateSupplierFormValues } from '../schemas/supplier.schema'

export const suppliersApi = {
  list: (query = '') => apiClient.get<Supplier[]>(`/api/suppliers${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  getById: (id: number) => apiClient.get<Supplier>(`/api/suppliers/${id}`),
  getAging: () => apiClient.get<SupplierAging[]>('/api/suppliers/aging'),
  getLedger: (id: number) => apiClient.get<SupplierTransaction[]>(`/api/suppliers/${id}/ledger`),
  create: (data: CreateSupplierFormValues) => apiClient.post<Supplier>('/api/suppliers', data),
  recordPayment: (id: number, data: RecordPaymentInput) =>
    apiClient.post(`/api/suppliers/${id}/payments`, data),
  adjustBalance: (id: number, data: AdjustBalanceInput) =>
    apiClient.post(`/api/suppliers/${id}/adjust`, data),
  remove: (id: number) => apiClient.delete<{ success: boolean }>(`/api/suppliers/${id}`)
}
