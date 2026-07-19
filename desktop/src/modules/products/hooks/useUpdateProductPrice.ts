import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productsApi } from '../services/products.api'

export function useUpdateProductPrice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ productId, defaultSalePrice }: { productId: number; defaultSalePrice: number }) =>
      productsApi.updateSalePrice(productId, defaultSalePrice),
    onSuccess: () => {
      toast.success('تم تحديث سعر البيع')
      queryClient.invalidateQueries({ queryKey: ['products', 'search'] })
    },
    onError: (error: Error) => {
      toast.error('فشل تحديث السعر', { description: error.message })
    }
  })
}
