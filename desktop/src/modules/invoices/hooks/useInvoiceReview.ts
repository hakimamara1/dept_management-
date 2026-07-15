import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-client'
import { invoicesApi } from '../services/invoices.api'

export function useInvoiceReview(id: number) {
  return useQuery({
    queryKey: queryKeys.invoices.review(id),
    queryFn: () => invoicesApi.getReview(id)
  })
}
