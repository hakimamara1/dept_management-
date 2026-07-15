import { apiClient } from '@shared/lib/api-client'
import type {
  DashboardStats,
  LowStockProduct,
  PendingInvoice,
  PurchaseTrendPoint,
  SupplierAging
} from '@shared/types/api'

export const dashboardApi = {
  getStats: () => apiClient.get<DashboardStats>('/api/analytics/dashboard'),
  getPurchaseTrend: () => apiClient.get<PurchaseTrendPoint[]>('/api/analytics/purchase-trend'),
  getLowStock: (threshold = 10) =>
    apiClient.get<LowStockProduct[]>(`/api/stock/low?threshold=${threshold}`),
  getPendingInvoices: () => apiClient.get<PendingInvoice[]>('/api/invoices/pending'),
  getSupplierAging: () => apiClient.get<SupplierAging[]>('/api/suppliers/aging')
}
