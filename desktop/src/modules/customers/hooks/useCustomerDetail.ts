import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-client'
import { customersApi } from '../services/customers.api'

export function useCustomer(id: number) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => customersApi.getById(id)
  })
}
