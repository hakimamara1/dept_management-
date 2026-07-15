import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-client'
import { paymentsApi } from '../services/payments.api'

export function usePayments() {
  return useQuery({
    queryKey: queryKeys.payments.list,
    queryFn: paymentsApi.getAll
  })
}
