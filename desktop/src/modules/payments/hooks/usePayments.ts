import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-client'
import type { PaymentFilters } from '@shared/types/api'
import { paymentsApi } from '../services/payments.api'

export function usePayments(filters: PaymentFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.payments.list(filters),
    queryFn: () => paymentsApi.getAll(filters),
    enabled
  })
}

export function usePaymentAnalytics(filters: PaymentFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.payments.analytics(filters),
    queryFn: () => paymentsApi.getAnalytics(filters),
    enabled
  })
}
