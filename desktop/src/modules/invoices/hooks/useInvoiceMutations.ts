import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@shared/lib/query-client'
import type { AddInvoiceItemInput, CreateManualInvoiceInput, UpdateInvoiceItemInput } from '@shared/types/api'
import { invoicesApi } from '../services/invoices.api'

// Not scoped to one invoiceId at hook level (unlike most hooks in this
// file) — used both from a single review page and from a list of rows
// (InvoicesPage's Pending tab), so the id is passed at mutate() time.
export function useDeleteInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (invoiceId: number) => invoicesApi.deleteInvoice(invoiceId),
    onSuccess: () => {
      toast.success('تم حذف الفاتورة')
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.pending })
    },
    onError: (error: Error) => {
      toast.error('فشل حذف الفاتورة', { description: error.message })
    }
  })
}

export function useExtractInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (file: File) => invoicesApi.extract(file),
    onSuccess: (result) => {
      toast.success(`تم استخراج الفاتورة (رقم ${result.invoiceId}) — راجعها قبل الاعتماد`)
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.pending })
    },
    onError: (error: Error) => {
      toast.error('فشل استخراج الفاتورة', { description: error.message })
    }
  })
}

export function useCreateManualInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateManualInvoiceInput) => invoicesApi.createManual(data),
    onSuccess: (result) => {
      toast.success(`تم إنشاء الفاتورة (رقم ${result.invoiceId}) — راجعها قبل الاعتماد`)
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.pending })
    },
    onError: (error: Error) => {
      toast.error('فشل إنشاء الفاتورة', { description: error.message })
    }
  })
}

export function useAddInvoiceAttachments(invoiceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (files: File[]) => invoicesApi.addAttachments(invoiceId, files),
    onSuccess: () => {
      toast.success('تم إرفاق الصورة')
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.review(invoiceId) })
    },
    onError: (error: Error) => {
      toast.error('فشل إرفاق الصورة', { description: error.message })
    }
  })
}

export function useDeleteInvoiceAttachment(invoiceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (attachmentId: number) => invoicesApi.deleteAttachment(invoiceId, attachmentId),
    onSuccess: () => {
      toast.success('تم حذف الصورة')
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.review(invoiceId) })
    },
    onError: (error: Error) => {
      toast.error('فشل حذف الصورة', { description: error.message })
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

export function useUpdateInvoiceSupplier(invoiceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (supplierId: number) => invoicesApi.updateSupplier(invoiceId, supplierId),
    onSuccess: () => {
      toast.success('تم تحديد المورد')
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.review(invoiceId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.pending })
    },
    onError: (error: Error) => {
      toast.error('فشل تحديد المورد', { description: error.message })
    }
  })
}
