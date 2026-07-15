import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@shared/lib/query-client'
import { customersApi } from '../services/customers.api'
import type { CreateCustomerFormValues } from '../schemas/customer.schema'
import type { CreateSalesInvoiceFormValues } from '../schemas/salesInvoice.schema'
import type { RecordCustomerPaymentFormValues } from '../schemas/payment.schema'

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
      toast.success(`تم إنشاء الفاتورة ${invoice.invoice_number} بنجاح`)
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.invoices(customerId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(customerId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.statement(customerId) })
      queryClient.invalidateQueries({ queryKey: ['customers', 'list'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.reports })
    },
    onError: (error: Error) => {
      toast.error('فشل إنشاء الفاتورة', { description: error.message })
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
