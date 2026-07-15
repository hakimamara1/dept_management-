import { apiClient } from '@shared/lib/api-client'
import type { BalanceSheet, BalanceVerification, ProfitLoss, TrialBalanceRow } from '@shared/types/api'

export const reportsApi = {
  getTrialBalance: () => apiClient.get<TrialBalanceRow[]>('/api/accounting/trial-balance'),
  getBalanceSheet: () => apiClient.get<BalanceSheet>('/api/accounting/balance-sheet'),
  getProfitLoss: () => apiClient.get<ProfitLoss>('/api/accounting/profit-loss'),
  verifyBalance: () => apiClient.get<BalanceVerification>('/api/accounting/verify')
}
