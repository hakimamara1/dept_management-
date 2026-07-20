import { apiClient } from '@shared/lib/api-client'
import type {
  ActivityEntry,
  DashboardKpis,
  DebtBySupplierEntry,
  DebtEvolutionResponse,
  OutstandingDebtEntry,
  PriceChangesResponse,
  PurchaseAnalytics
} from '@shared/types/api'

function rangeQuery(range: string, from?: string, to?: string) {
  const params = new URLSearchParams({ range })
  if (range === 'custom') {
    if (from) params.set('from', from)
    if (to) params.set('to', to)
  }
  return params.toString()
}

export const dashboardAnalyticsApi = {
  getKpis: (range: string, from?: string, to?: string) =>
    apiClient.get<DashboardKpis>(`/api/dashboard/kpis?${rangeQuery(range, from, to)}`),
  getDebtEvolution: (range: string, from?: string, to?: string) =>
    apiClient.get<DebtEvolutionResponse>(`/api/dashboard/debt-evolution?${rangeQuery(range, from, to)}`),
  getDebtBySupplier: (limit = 8) =>
    apiClient.get<DebtBySupplierEntry[]>(`/api/dashboard/debt-by-supplier?limit=${limit}`),
  getPurchaseAnalytics: (range: string, from?: string, to?: string) =>
    apiClient.get<PurchaseAnalytics>(`/api/dashboard/purchases?${rangeQuery(range, from, to)}`),
  getPriceChanges: (range: string, from?: string, to?: string) =>
    apiClient.get<PriceChangesResponse>(`/api/dashboard/price-changes?${rangeQuery(range, from, to)}`),
  getOutstandingDebts: (limit = 10) =>
    apiClient.get<OutstandingDebtEntry[]>(`/api/dashboard/outstanding-debts?limit=${limit}`),
  getActivity: (limit = 20) =>
    apiClient.get<ActivityEntry[]>(`/api/dashboard/activity?limit=${limit}`)
}
