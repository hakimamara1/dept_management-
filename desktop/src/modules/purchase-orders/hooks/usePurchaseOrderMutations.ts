import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@shared/lib/query-client'
import type {
  AddPurchaseOrderItemInput,
  CreatePurchaseOrderInput,
  PurchaseOrderStatus,
  UpdatePurchaseOrderInput,
  UpdatePurchaseOrderItemInput
} from '@shared/types/api'
import { purchaseOrdersApi } from '../services/purchaseOrders.api'

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreatePurchaseOrderInput) => purchaseOrdersApi.create(data),
    onSuccess: (order) => {
      toast.success(`تم إنشاء أمر الشراء #${order.id} بنجاح`)
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.list })
    },
    onError: (error: Error) => {
      toast.error('فشل إنشاء أمر الشراء', { description: error.message })
    }
  })
}

export function useUpdatePurchaseOrderStatus(id: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (status: PurchaseOrderStatus) => purchaseOrdersApi.updateStatus(id, status),
    onSuccess: () => {
      toast.success('تم تحديث حالة أمر الشراء')
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.list })
    },
    onError: (error: Error) => {
      toast.error('فشل تحديث الحالة', { description: error.message })
    }
  })
}

export function useUpdatePurchaseOrder(id: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdatePurchaseOrderInput) => purchaseOrdersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.list })
    },
    onError: (error: Error) => {
      toast.error('فشل تعديل أمر الشراء', { description: error.message })
    }
  })
}

export function useUpdatePurchaseOrderItem(id: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: number; data: UpdatePurchaseOrderItemInput }) =>
      purchaseOrdersApi.updateItem(id, itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.list })
    },
    onError: (error: Error) => {
      toast.error('فشل تعديل الصنف', { description: error.message })
    }
  })
}

export function useAddPurchaseOrderItem(id: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: AddPurchaseOrderItemInput) => purchaseOrdersApi.addItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.list })
    },
    onError: (error: Error) => {
      toast.error('فشل إضافة الصنف', { description: error.message })
    }
  })
}

export function useDeletePurchaseOrderItem(id: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (itemId: number) => purchaseOrdersApi.deleteItem(id, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.list })
    },
    onError: (error: Error) => {
      toast.error('فشل حذف الصنف', { description: error.message })
    }
  })
}
