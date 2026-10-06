import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AddSalesInvoiceItemInput, CreateSalesInvoiceInput, UpdateSalesInvoiceItemInput } from '@desktop-types/api'
import { salesInvoicesApi } from '../services/salesInvoices.api'

const keys = {
  list: (customerId: number) => ['customers', 'invoices', customerId] as const,
  detail: (customerId: number, invoiceId: number) => ['customers', 'invoice', customerId, invoiceId] as const
}

export const useCustomerInvoices = (customerId: number) =>
  useQuery({ queryKey: keys.list(customerId), queryFn: () => salesInvoicesApi.list(customerId) })

export const useCustomerInvoice = (customerId: number, invoiceId: number) =>
  useQuery({ queryKey: keys.detail(customerId, invoiceId), queryFn: () => salesInvoicesApi.get(customerId, invoiceId) })

/** Draft edits only change the invoice itself; approve/delete move the customer's real balance too. */
export function useInvoiceMutations(customerId: number, invoiceId: number) {
  const queryClient = useQueryClient()
  const refreshInvoice = () => {
    queryClient.invalidateQueries({ queryKey: keys.detail(customerId, invoiceId) })
    queryClient.invalidateQueries({ queryKey: keys.list(customerId) })
  }
  const refreshBalances = () => {
    for (const root of ['customers', 'reports']) queryClient.invalidateQueries({ queryKey: [root] })
  }

  return {
    updateItem: useMutation({
      mutationFn: ({ itemId, data }: { itemId: number; data: UpdateSalesInvoiceItemInput }) =>
        salesInvoicesApi.updateItem(customerId, invoiceId, itemId, data),
      onSuccess: refreshInvoice
    }),
    addItem: useMutation({
      mutationFn: (data: AddSalesInvoiceItemInput) => salesInvoicesApi.addItem(customerId, invoiceId, data),
      onSuccess: refreshInvoice
    }),
    deleteItem: useMutation({
      mutationFn: (itemId: number) => salesInvoicesApi.deleteItem(customerId, invoiceId, itemId),
      onSuccess: refreshInvoice
    }),
    updateNotes: useMutation({
      mutationFn: (notes: string) => salesInvoicesApi.updateNotes(customerId, invoiceId, notes),
      onSuccess: refreshInvoice
    }),
    deleteInvoice: useMutation({
      mutationFn: () => salesInvoicesApi.deleteInvoice(customerId, invoiceId),
      onSuccess: refreshBalances
    }),
    approve: useMutation({
      mutationFn: (key: string) => salesInvoicesApi.approve(customerId, invoiceId, key),
      onSuccess: () => { refreshInvoice(); refreshBalances() }
    })
  }
}

export function useCreateSalesInvoice(customerId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ data, key }: { data: CreateSalesInvoiceInput; key: string }) => salesInvoicesApi.create(customerId, data, key),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.list(customerId) })
  })
}
