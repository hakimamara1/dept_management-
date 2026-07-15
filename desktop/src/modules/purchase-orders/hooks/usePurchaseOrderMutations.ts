import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@shared/lib/query-client'
import type { CreatePurchaseOrderInput, PurchaseOrderStatus } from '@shared/types/api'
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
