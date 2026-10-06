import { api } from '@/shared/api/client'
import type { DebtAnalysis, DebtAnalysisFilters } from '@desktop-types/api'

export function debtAnalysisQuery({ scope, range, from, to, entityId }: DebtAnalysisFilters): string {
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
    api.get<DebtAnalysis>(`/api/reports/debt-analysis?${debtAnalysisQuery(filters)}`)
}
