import { api } from '@/shared/api/client'
import type { Supplier, SupplierTransaction } from '@desktop-types/api'

export const suppliersApi = {
  list: (query = '') => api.get<Supplier[]>(`/api/suppliers${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  getById: (id: number) => api.get<Supplier>(`/api/suppliers/${id}`),
  getLedger: (id: number) => api.get<SupplierTransaction[]>(`/api/suppliers/${id}/ledger`)
}
