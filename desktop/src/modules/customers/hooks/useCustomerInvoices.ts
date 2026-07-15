import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-client'
import { customersApi } from '../services/customers.api'

export function useCustomerInvoices(customerId: number) {
  return useQuery({
    queryKey: queryKeys.customers.invoices(customerId),
    queryFn: () => customersApi.getInvoices(customerId)
  })
}

export function useCustomerInvoice(customerId: number, invoiceId: number) {
  return useQuery({
    queryKey: queryKeys.customers.invoice(customerId, invoiceId),
    queryFn: () => customersApi.getInvoice(customerId, invoiceId)
  })
}
