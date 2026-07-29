import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@shared/lib/query-client'
import { suppliersApi } from '../services/suppliers.api'
import type { AdjustBalanceFormValues, CreateSupplierFormValues, RecordPaymentFormValues } from '../schemas/supplier.schema'

export function useCreateSupplier() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateSupplierFormValues) => suppliersApi.create(data),
    onSuccess: () => {
      toast.success('تمت إضافة المورد بنجاح')
      queryClient.invalidateQueries({ queryKey: ['suppliers', 'list'] })
    },
    onError: (error: Error) => {
      toast.error('فشل إضافة المورد', { description: error.message })
    }
  })
}

export function useRecordPayment(supplierId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: RecordPaymentFormValues) => suppliersApi.recordPayment(supplierId, data),
    onSuccess: () => {
      toast.success('تم تسجيل الدفعة بنجاح')
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.detail(supplierId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.ledger(supplierId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.aging })
      queryClient.invalidateQueries({ queryKey: ['suppliers', 'list'] })
    },
    onError: (error: Error) => {
      toast.error('فشل تسجيل الدفعة', { description: error.message })
    }
  })
}

export function useDeleteSupplier(supplierId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => suppliersApi.remove(supplierId),
    onSuccess: () => {
      toast.success('تم حذف المورد بنجاح')
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.detail(supplierId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.ledger(supplierId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.aging })
      queryClient.invalidateQueries({ queryKey: ['suppliers', 'list'] })
    },
    onError: (error: Error) => {
      toast.error('فشل حذف المورد', { description: error.message })
    }
  })
}

export function useAdjustBalance(supplierId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: AdjustBalanceFormValues) => suppliersApi.adjustBalance(supplierId, data),
    onSuccess: () => {
      toast.success('تم تسوية الرصيد بنجاح')
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.detail(supplierId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.ledger(supplierId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.aging })
      queryClient.invalidateQueries({ queryKey: ['suppliers', 'list'] })
    },
    onError: (error: Error) => {
      toast.error('فشل تسوية الرصيد', { description: error.message })
    }
  })
}
