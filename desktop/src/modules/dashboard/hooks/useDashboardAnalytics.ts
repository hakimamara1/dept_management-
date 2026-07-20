import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-client'
import { dashboardAnalyticsApi } from '../services/dashboardAnalytics.api'

export function useDashboardKpis(range: string, from?: string, to?: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.kpis(range, from, to),
    queryFn: () => dashboardAnalyticsApi.getKpis(range, from, to)
  })
}

export function useDebtEvolution(range: string, from?: string, to?: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.debtEvolution(range, from, to),
    queryFn: () => dashboardAnalyticsApi.getDebtEvolution(range, from, to)
  })
}

export function useDebtBySupplier(limit = 8) {
  return useQuery({
    queryKey: queryKeys.dashboard.debtBySupplier,
    queryFn: () => dashboardAnalyticsApi.getDebtBySupplier(limit)
  })
}

export function usePurchaseAnalytics(range: string, from?: string, to?: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.purchases(range, from, to),
    queryFn: () => dashboardAnalyticsApi.getPurchaseAnalytics(range, from, to)
  })
}

export function usePriceChanges(range: string, from?: string, to?: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.priceChanges(range, from, to),
    queryFn: () => dashboardAnalyticsApi.getPriceChanges(range, from, to)
  })
}

export function useOutstandingDebts(limit = 10) {
  return useQuery({
    queryKey: queryKeys.dashboard.outstandingDebts,
    queryFn: () => dashboardAnalyticsApi.getOutstandingDebts(limit)
  })
}

export function useRecentActivity(limit = 20) {
  return useQuery({
    queryKey: queryKeys.dashboard.activity,
    queryFn: () => dashboardAnalyticsApi.getActivity(limit)
  })
}
