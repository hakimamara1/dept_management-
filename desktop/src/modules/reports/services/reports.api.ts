import { apiClient } from '@shared/lib/api-client'
import type {
  BalanceSheet,
  BalanceVerification,
  DebtAnalysis,
  DebtAnalysisFilters,
  ProfitLoss,
  TrialBalanceRow
} from '@shared/types/api'

function debtAnalysisQuery({ scope, range, from, to, entityId }: DebtAnalysisFilters): string {
  const params = new URLSearchParams({ scope, range })
  if (range === 'custom') {
    if (from) params.set('from', from)
    if (to) params.set('to', to)
  }
  if (entityId) params.set('entityId', String(entityId))
  return params.toString()
}

export const reportsApi = {
  getDebtAnalysis: (filters: DebtAnalysisFilters) =>
    apiClient.get<DebtAnalysis>(`/api/reports/debt-analysis?${debtAnalysisQuery(filters)}`),
  getTrialBalance: () => apiClient.get<TrialBalanceRow[]>('/api/accounting/trial-balance'),
  getBalanceSheet: () => apiClient.get<BalanceSheet>('/api/accounting/balance-sheet'),
  getProfitLoss: () => apiClient.get<ProfitLoss>('/api/accounting/profit-loss'),
  verifyBalance: () => apiClient.get<BalanceVerification>('/api/accounting/verify')
}
