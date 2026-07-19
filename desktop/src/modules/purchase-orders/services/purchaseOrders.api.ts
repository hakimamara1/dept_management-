import { apiClient } from '@shared/lib/api-client'
import type {
  AddPurchaseOrderItemInput,
  CreatePurchaseOrderInput,
  PurchaseOrder,
  PurchaseOrderDetail,
  PurchaseOrderStatus,
  UpdatePurchaseOrderInput,
  UpdatePurchaseOrderItemInput
} from '@shared/types/api'

export const purchaseOrdersApi = {
  getAll: () => apiClient.get<PurchaseOrder[]>('/api/purchase-orders'),
  getById: (id: number) => apiClient.get<PurchaseOrderDetail>(`/api/purchase-orders/${id}`),
  create: (data: CreatePurchaseOrderInput) => apiClient.post<PurchaseOrderDetail>('/api/purchase-orders', data),
  updateStatus: (id: number, status: PurchaseOrderStatus) =>
    apiClient.patch<PurchaseOrderDetail>(`/api/purchase-orders/${id}/status`, { status }),

  // Draft-only — the backend rejects all of these once the PO isn't Draft.
  update: (id: number, data: UpdatePurchaseOrderInput) =>
    apiClient.patch<PurchaseOrderDetail>(`/api/purchase-orders/${id}`, data),
  updateItem: (id: number, itemId: number, data: UpdatePurchaseOrderItemInput) =>
    apiClient.patch<PurchaseOrderDetail>(`/api/purchase-orders/${id}/items/${itemId}`, data),
  addItem: (id: number, data: AddPurchaseOrderItemInput) =>
    apiClient.post<PurchaseOrderDetail>(`/api/purchase-orders/${id}/items`, data),
  deleteItem: (id: number, itemId: number) =>
    apiClient.delete<PurchaseOrderDetail>(`/api/purchase-orders/${id}/items/${itemId}`)
}
