import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@shared/lib/query-client'
import type { AddInvoiceItemInput, UpdateInvoiceItemInput } from '@shared/types/api'
import { invoicesApi } from '../services/invoices.api'

export function useSubmitInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ocrJson: unknown) => invoicesApi.submit(ocrJson),
    onSuccess: (result) => {
      toast.success(`تم استلام الفاتورة (رقم ${result.invoiceId}) — راجعها قبل الاعتماد`)
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.pending })
    },
    onError: (error: Error) => {
      toast.error('فشل رفع الفاتورة', { description: error.message })
    }
  })
}

export function useApproveInvoice(invoiceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => invoicesApi.approve(invoiceId),
    onSuccess: () => {
      toast.success('تم اعتماد الفاتورة بنجاح')
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.pending })
      queryClient.invalidateQueries({ queryKey: ['invoices', 'approved'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.review(invoiceId) })
    },
    onError: (error: Error) => {
      toast.error('فشل اعتماد الفاتورة', { description: error.message })
    }
  })
}

export function useUpdateInvoiceItem(invoiceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: number; data: UpdateInvoiceItemInput }) =>
      invoicesApi.updateItem(invoiceId, itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.review(invoiceId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.pending })
    },
    onError: (error: Error) => {
      toast.error('فشل تعديل الصنف', { description: error.message })
    }
  })
}

export function useAddInvoiceItem(invoiceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: AddInvoiceItemInput) => invoicesApi.addItem(invoiceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.review(invoiceId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.pending })
    },
    onError: (error: Error) => {
      toast.error('فشل إضافة الصنف', { description: error.message })
    }
  })
}

export function useDeleteInvoiceItem(invoiceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (itemId: number) => invoicesApi.deleteItem(invoiceId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.review(invoiceId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.pending })
    },
    onError: (error: Error) => {
      toast.error('فشل حذف الصنف', { description: error.message })
    }
  })
}

export function useUpdateInvoiceNotes(invoiceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (notes: string) => invoicesApi.updateNotes(invoiceId, notes),
    onSuccess: () => {
      toast.success('تم حفظ الملاحظات')
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.review(invoiceId) })
    },
    onError: (error: Error) => {
      toast.error('فشل حفظ الملاحظات', { description: error.message })
    }
  })
}
