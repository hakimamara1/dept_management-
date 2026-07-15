import { apiClient } from '@shared/lib/api-client'
import type { CreatePurchaseOrderInput, PurchaseOrder, PurchaseOrderDetail, PurchaseOrderStatus } from '@shared/types/api'

export const purchaseOrdersApi = {
  getAll: () => apiClient.get<PurchaseOrder[]>('/api/purchase-orders'),
  getById: (id: number) => apiClient.get<PurchaseOrderDetail>(`/api/purchase-orders/${id}`),
  create: (data: CreatePurchaseOrderInput) => apiClient.post<PurchaseOrderDetail>('/api/purchase-orders', data),
  updateStatus: (id: number, status: PurchaseOrderStatus) =>
    apiClient.patch<PurchaseOrderDetail>(`/api/purchase-orders/${id}/status`, { status })
}
