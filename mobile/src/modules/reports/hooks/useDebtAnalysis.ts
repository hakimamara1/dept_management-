import { useQuery } from '@tanstack/react-query'
import type { DebtAnalysisFilters } from '@desktop-types/api'
import { reportsApi } from '../services/reports.api'

export function useDebtAnalysis(filters: DebtAnalysisFilters) {
  return useQuery({
    queryKey: ['reports', 'debt-analysis', filters],
    queryFn: () => reportsApi.getDebtAnalysis(filters)
  })
}
