import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@shared/lib/query-client'
import type { AddSalesInvoiceItemInput, UpdateSalesInvoiceItemInput } from '@shared/types/api'
import { customersApi } from '../services/customers.api'

function invalidateInvoice(queryClient: ReturnType<typeof useQueryClient>, customerId: number, invoiceId: number) {
  queryClient.invalidateQueries({ queryKey: queryKeys.customers.invoice(customerId, invoiceId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.customers.invoices(customerId) })
}

// A draft has zero effect on the balance, so item edits only ever touch the
// invoice itself. Approve/delete change the customer's real balance, so
// they additionally invalidate everything balance-derived.
function invalidateBalanceDerived(queryClient: ReturnType<typeof useQueryClient>, customerId: number) {
  queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(customerId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.customers.statement(customerId) })
  queryClient.invalidateQueries({ queryKey: ['customers', 'list'] })
  queryClient.invalidateQueries({ queryKey: queryKeys.customers.reports })
}

export function useUpdateSalesInvoiceItem(customerId: number, invoiceId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: number; data: UpdateSalesInvoiceItemInput }) =>
      customersApi.updateInvoiceItem(customerId, invoiceId, itemId, data),
    onSuccess: () => invalidateInvoice(queryClient, customerId, invoiceId),
    onError: (error: Error) => toast.error('فشل تعديل الصنف', { description: error.message })
  })
}

export function useAddSalesInvoiceItem(customerId: number, invoiceId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: AddSalesInvoiceItemInput) => customersApi.addInvoiceItem(customerId, invoiceId, data),
    onSuccess: () => invalidateInvoice(queryClient, customerId, invoiceId),
    onError: (error: Error) => toast.error('فشل إضافة الصنف', { description: error.message })
  })
}

export function useDeleteSalesInvoiceItem(customerId: number, invoiceId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId: number) => customersApi.deleteInvoiceItem(customerId, invoiceId, itemId),
    onSuccess: () => invalidateInvoice(queryClient, customerId, invoiceId),
    onError: (error: Error) => toast.error('فشل حذف الصنف', { description: error.message })
  })
}

export function useUpdateSalesInvoiceNotes(customerId: number, invoiceId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (notes: string) => customersApi.updateInvoiceNotes(customerId, invoiceId, notes),
    onSuccess: () => invalidateInvoice(queryClient, customerId, invoiceId),
    onError: (error: Error) => toast.error('فشل حفظ الملاحظات', { description: error.message })
  })
}

export function useDeleteSalesInvoice(customerId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (invoiceId: number) => customersApi.deleteInvoice(customerId, invoiceId),
    onSuccess: () => {
      toast.success('تم حذف المسودة')
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.invoices(customerId) })
    },
    onError: (error: Error) => toast.error('فشل حذف المسودة', { description: error.message })
  })
}

export function useApproveSalesInvoice(customerId: number, invoiceId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => customersApi.approveInvoice(customerId, invoiceId),
    onSuccess: (invoice) => {
      toast.success(`تم اعتماد الفاتورة ${invoice.invoice_number}`)
      invalidateInvoice(queryClient, customerId, invoiceId)
      invalidateBalanceDerived(queryClient, customerId)
    },
    onError: (error: Error) => toast.error('فشل اعتماد الفاتورة', { description: error.message })
  })
}
