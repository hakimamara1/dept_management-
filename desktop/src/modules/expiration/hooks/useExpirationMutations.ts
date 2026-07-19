import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CreateExpirationBatchInput, ExpirationBatchStatus, UpdateExpirationBatchInput } from '@shared/types/api'
import { expirationApi } from '../services/expiration.api'

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['expiration'] })
}

export function useCreateExpirationBatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateExpirationBatchInput) => expirationApi.create(data),
    onSuccess: () => {
      toast.success('تم تسجيل الدفعة بنجاح')
      invalidateAll(queryClient)
    },
    onError: (error: Error) => {
      toast.error('فشل تسجيل الدفعة', { description: error.message })
    }
  })
}

export function useUpdateExpirationBatch(id: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateExpirationBatchInput) => expirationApi.update(id, data),
    onSuccess: () => {
      toast.success('تم حفظ التعديلات')
      invalidateAll(queryClient)
    },
    onError: (error: Error) => {
      toast.error('فشل حفظ التعديلات', { description: error.message })
    }
  })
}

export function useSetExpirationBatchStatus(id: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (status: ExpirationBatchStatus) => expirationApi.setStatus(id, status),
    onSuccess: () => {
      toast.success('تم تحديث حالة الدفعة')
      invalidateAll(queryClient)
    },
    onError: (error: Error) => {
      toast.error('فشل تحديث الحالة', { description: error.message })
    }
  })
}

export function useDeleteExpirationBatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => expirationApi.delete(id),
    onSuccess: () => {
      toast.success('تم حذف الدفعة')
      invalidateAll(queryClient)
    },
    onError: (error: Error) => {
      toast.error('فشل حذف الدفعة', { description: error.message })
    }
  })
}
