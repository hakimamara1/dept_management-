import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-client'
import { customersApi } from '../services/customers.api'

export function useCustomerPayments(customerId: number) {
  return useQuery({
    queryKey: queryKeys.customers.payments(customerId),
    queryFn: () => customersApi.getPayments(customerId)
  })
}
