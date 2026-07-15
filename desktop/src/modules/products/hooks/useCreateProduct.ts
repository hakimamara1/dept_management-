import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productsApi } from '../services/products.api'
import type { ProductFormValues } from '../schemas/product.schema'

export function useCreateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ProductFormValues) => productsApi.create(data),
    onSuccess: (result, variables) => {
      toast.success(`تم إضافة المنتج "${variables.name}" بنجاح`, {
        description: `رقم المنتج: ${result.id}`
      })
      queryClient.invalidateQueries({ queryKey: ['products', 'search'] })
    },
    onError: (error: Error) => {
      toast.error('فشل إنشاء المنتج', { description: error.message })
    }
  })
}
