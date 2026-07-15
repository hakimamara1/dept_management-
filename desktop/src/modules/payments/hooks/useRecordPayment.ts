import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@shared/lib/query-client'
import { paymentsApi } from '../services/payments.api'
import type { RecordPaymentFormValues } from '../schemas/payment.schema'

export function useRecordPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: RecordPaymentFormValues) =>
      paymentsApi.record(values.supplier!.id, {
        amount: values.amount,
        paymentMethod: values.paymentMethod,
        reference: values.reference,
        notes: values.notes,
        date: values.date
      }),
    onSuccess: (_, values) => {
      toast.success(`تم تسجيل الدفعة لـ "${values.supplier?.name}" بنجاح`)
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.list })
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.aging })
      queryClient.invalidateQueries({ queryKey: ['suppliers', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers', 'detail'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers', 'ledger'] })
    },
    onError: (error: Error) => {
      toast.error('فشل تسجيل الدفعة', { description: error.message })
    }
  })
}
