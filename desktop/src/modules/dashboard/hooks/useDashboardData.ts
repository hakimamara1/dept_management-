import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-client'
import { dashboardApi } from '../services/dashboard.api'

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard.stats,
    queryFn: dashboardApi.getStats
  })
}

export function usePurchaseTrend() {
  return useQuery({
    queryKey: queryKeys.dashboard.purchaseTrend,
    queryFn: dashboardApi.getPurchaseTrend
  })
}

export function useLowStock(threshold = 10) {
  return useQuery({
    queryKey: queryKeys.stock.low(threshold),
    queryFn: () => dashboardApi.getLowStock(threshold)
  })
}

export function usePendingInvoices() {
  return useQuery({
    queryKey: queryKeys.invoices.pending,
    queryFn: dashboardApi.getPendingInvoices
  })
}

export function useSupplierAging() {
  return useQuery({
    queryKey: queryKeys.suppliers.aging,
    queryFn: dashboardApi.getSupplierAging
  })
}
