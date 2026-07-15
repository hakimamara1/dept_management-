import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-client'
import { customersApi } from '../services/customers.api'

export function useCustomerStatement(customerId: number) {
  return useQuery({
    queryKey: queryKeys.customers.statement(customerId),
    queryFn: () => customersApi.getStatement(customerId)
  })
}
