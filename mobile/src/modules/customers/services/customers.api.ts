import { api } from '@/shared/api/client'
import type { Customer, CustomerStatementEntry } from '@desktop-types/api'

export const customersApi = {
  list: (query = '') => api.get<Customer[]>(`/api/customers${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  getById: (id: number) => api.get<Customer>(`/api/customers/${id}`),
  getStatement: (id: number) => api.get<CustomerStatementEntry[]>(`/api/customers/${id}/statement`)
}
