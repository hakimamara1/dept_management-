import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@shared/lib/query-client'
import { customersApi } from '../services/customers.api'
import type { CreateCustomerFormValues } from '../schemas/customer.schema'
import type { CreateSalesInvoiceFormValues } from '../schemas/salesInvoice.schema'
import type { AdjustCustomerBalanceFormValues, RecordCustomerPaymentFormValues } from '../schemas/payment.schema'

export function useCreateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateCustomerFormValues) => customersApi.create(data),
    onSuccess: (customer) => {
      toast.success(`تم إضافة العميل "${customer.full_name}" بنجاح`)
      queryClient.invalidateQueries({ queryKey: ['customers', 'list'] })
    },
    onError: (error: Error) => {
      toast.error('فشل إضافة العميل', { description: error.message })
    }
  })
}

export function useCreateSalesInvoice(customerId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateSalesInvoiceFormValues) => customersApi.createInvoice(customerId, data),
    onSuccess: (invoice) => {
      // A Draft has zero effect on the balance/statement/reports — only
      // the invoices list actually changed, so only that needs refetching.
      toast.success(`تم حفظ المسودة ${invoice.invoice_number} — راجعها واعتمدها من صفحتها`)
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.invoices(customerId) })
    },
    onError: (error: Error) => {
      toast.error('فشل حفظ المسودة', { description: error.message })
    }
  })
}

export function useRecordCustomerPayment(customerId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: RecordCustomerPaymentFormValues) => customersApi.recordPayment(customerId, data),
    onSuccess: () => {
      toast.success('تم تسجيل الدفعة بنجاح')
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.payments(customerId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(customerId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.statement(customerId) })
      queryClient.invalidateQueries({ queryKey: ['customers', 'list'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.reports })
    },
    onError: (error: Error) => {
      toast.error('فشل تسجيل الدفعة', { description: error.message })
    }
  })
}

export function useAdjustCustomerBalance(customerId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: AdjustCustomerBalanceFormValues) => customersApi.adjustBalance(customerId, data),
    onSuccess: () => {
      toast.success('تم تسوية الرصيد بنجاح')
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(customerId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.statement(customerId) })
      queryClient.invalidateQueries({ queryKey: ['customers', 'list'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.reports })
    },
    onError: (error: Error) => {
      toast.error('فشل تسوية الرصيد', { description: error.message })
    }
  })
}
