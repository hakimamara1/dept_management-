import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { UpdateProductInput } from '@shared/types/api'
import { productsApi } from '../services/products.api'

export function useUpdateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ productId, data }: { productId: number; data: UpdateProductInput }) =>
      productsApi.update(productId, data),
    onSuccess: () => {
      toast.success('تم تحديث المنتج')
      queryClient.invalidateQueries({ queryKey: ['products', 'search'] })
    },
    onError: (error: Error) => {
      toast.error('فشل تحديث المنتج', { description: error.message })
    }
  })
}
