import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-client'
import { customersApi } from '../services/customers.api'

export function useCustomerReports() {
  return useQuery({
    queryKey: queryKeys.customers.reports,
    queryFn: customersApi.getReportsSummary
  })
}
