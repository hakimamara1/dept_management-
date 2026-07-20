import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productsApi } from '../services/products.api'

export function useMergeProducts() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ keepId, mergeId }: { keepId: number; mergeId: number }) =>
      productsApi.merge(keepId, mergeId),
    onSuccess: () => {
      toast.success('تم دمج المنتجين')
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (error: Error) => {
      toast.error('فشل دمج المنتجين', { description: error.message })
    }
  })
}
