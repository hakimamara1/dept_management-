import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-client'
import { invoicesApi } from '../services/invoices.api'

export function usePendingInvoices() {
  return useQuery({
    queryKey: queryKeys.invoices.pending,
    queryFn: invoicesApi.getPending
  })
}

export function useApprovedInvoices(limit = 100) {
  return useQuery({
    queryKey: queryKeys.invoices.approved(limit),
    queryFn: () => invoicesApi.getApproved(limit)
  })
}
