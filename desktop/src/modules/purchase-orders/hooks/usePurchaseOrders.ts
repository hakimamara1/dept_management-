import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-client'
import { purchaseOrdersApi } from '../services/purchaseOrders.api'

export function usePurchaseOrders() {
  return useQuery({
    queryKey: queryKeys.purchaseOrders.list,
    queryFn: purchaseOrdersApi.getAll
  })
}

export function usePurchaseOrder(id: number) {
  return useQuery({
    queryKey: queryKeys.purchaseOrders.detail(id),
    queryFn: () => purchaseOrdersApi.getById(id)
  })
}
