import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AddInvoiceItemInput, UpdateInvoiceItemInput } from '@desktop-types/api'
import { invoicesApi } from '../services/invoices.api'

export const invoiceKeys = {
  pending: ['invoices', 'pending'] as const,
  review: (id: number) => ['invoices', 'review', id] as const
}

export const usePendingInvoices = () => useQuery({ queryKey: invoiceKeys.pending, queryFn: invoicesApi.getPending })

export const useInvoiceReview = (id: number) =>
  useQuery({ queryKey: invoiceKeys.review(id), queryFn: () => invoicesApi.getReview(id) })

export function useExtractInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ photo, key }: { photo: { uri: string; name: string; type: string }; key: string }) => invoicesApi.extract(photo, key),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invoiceKeys.pending })
  })
}

export function useReviewMutations(invoiceId: number) {
  const queryClient = useQueryClient()
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: invoiceKeys.review(invoiceId) })
    queryClient.invalidateQueries({ queryKey: invoiceKeys.pending })
  }
  // Approval posts debt + stock + accounting, so everything balance-derived changes.
  const refreshEverything = () => {
    refresh()
    for (const root of ['suppliers', 'products', 'reports']) queryClient.invalidateQueries({ queryKey: [root] })
  }
  return {
    updateItem: useMutation({
      mutationFn: ({ itemId, data }: { itemId: number; data: UpdateInvoiceItemInput }) => invoicesApi.updateItem(invoiceId, itemId, data),
      onSuccess: refresh
    }),
    addItem: useMutation({ mutationFn: (data: AddInvoiceItemInput) => invoicesApi.addItem(invoiceId, data), onSuccess: refresh }),
    deleteItem: useMutation({ mutationFn: (itemId: number) => invoicesApi.deleteItem(invoiceId, itemId), onSuccess: refresh }),
    updateNotes: useMutation({ mutationFn: (notes: string) => invoicesApi.updateNotes(invoiceId, notes), onSuccess: refresh }),
    updateSupplier: useMutation({ mutationFn: (supplierId: number) => invoicesApi.updateSupplier(invoiceId, supplierId), onSuccess: refresh }),
    approve: useMutation({ mutationFn: (key: string) => invoicesApi.approve(invoiceId, key), onSuccess: refreshEverything }),
    deleteInvoice: useMutation({ mutationFn: () => invoicesApi.deleteInvoice(invoiceId), onSuccess: refresh })
  }
}
