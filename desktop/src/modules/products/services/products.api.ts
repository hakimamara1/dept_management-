import { apiClient } from '@shared/lib/api-client'
import type { PriceHistoryResponse, Product } from '@shared/types/api'
import type { ProductFormValues } from '../schemas/product.schema'

export const productsApi = {
  search: (query: string) => apiClient.get<Product[]>(`/api/products/search?query=${encodeURIComponent(query)}`),
  create: (data: ProductFormValues) =>
    apiClient.post<{ id: number }>('/api/products', {
      ...data,
      barcode: data.barcode || null,
      category: data.category || null
    }),
  getPriceHistory: (productId: number) =>
    apiClient.get<PriceHistoryResponse>(`/api/products/${productId}/price-history`)
}
