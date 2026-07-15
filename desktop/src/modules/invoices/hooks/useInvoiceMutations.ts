import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@shared/lib/query-client'
import type { InvoiceDecision } from '@shared/types/api'
import { invoicesApi } from '../services/invoices.api'

export function useSubmitInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ocrJson: unknown) => invoicesApi.submit(ocrJson),
    onSuccess: (result) => {
      const message =
        result.status === 'Approved'
          ? `تم اعتماد الفاتورة تلقائياً (رقم ${result.invoiceId})`
          : `تم استلام الفاتورة وهي بانتظار المراجعة (رقم ${result.invoiceId})`
      toast.success(message)
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.pending })
      queryClient.invalidateQueries({ queryKey: ['invoices', 'approved'] })
    },
    onError: (error: Error) => {
      toast.error('فشل رفع الفاتورة', { description: error.message })
    }
  })
}

export function useApproveInvoice(invoiceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (decisions: InvoiceDecision[]) => invoicesApi.approve(invoiceId, decisions),
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
