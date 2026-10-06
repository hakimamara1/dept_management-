import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-client'
import type { DebtAnalysisFilters } from '@shared/types/api'
import { reportsApi } from '../services/reports.api'

export function useTrialBalance() {
  return useQuery({
    queryKey: queryKeys.reports.trialBalance,
    queryFn: reportsApi.getTrialBalance
  })
}

export function useBalanceSheet() {
  return useQuery({
    queryKey: queryKeys.reports.balanceSheet,
    queryFn: reportsApi.getBalanceSheet
  })
}

export function useProfitLoss() {
  return useQuery({
    queryKey: queryKeys.reports.profitLoss,
    queryFn: reportsApi.getProfitLoss
  })
}

export function useVerifyBalance() {
  return useQuery({
    queryKey: queryKeys.reports.verify,
    queryFn: reportsApi.verifyBalance
  })
}

export function useDebtAnalysis(filters: DebtAnalysisFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.reports.debtAnalysis(filters),
    queryFn: () => reportsApi.getDebtAnalysis(filters),
    enabled
  })
}
