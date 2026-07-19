import { apiClient } from '@shared/lib/api-client'
import type { PriceHistoryResponse, Product, UpdateProductInput } from '@shared/types/api'
import type { ProductFormValues } from '../schemas/product.schema'

export const productsApi = {
  search: (query: string) => apiClient.get<Product[]>(`/api/products/search?query=${encodeURIComponent(query)}`),
  create: (data: ProductFormValues) =>
    apiClient.post<{ id: number }>('/api/products', {
      ...data,
      barcode: data.barcode || null,
      category: data.category || null,
      defaultSalePrice: data.defaultSalePrice ?? null
    }),
  update: (productId: number, data: UpdateProductInput) =>
    apiClient.patch<Product>(`/api/products/${productId}`, data),
  getPriceHistory: (productId: number) =>
    apiClient.get<PriceHistoryResponse>(`/api/products/${productId}/price-history`),
  updateSalePrice: (productId: number, defaultSalePrice: number) =>
    apiClient.patch<Product>(`/api/products/${productId}/price`, { defaultSalePrice })
}
