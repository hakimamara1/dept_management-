import { apiClient } from '@shared/lib/api-client'
import type { PriceHistoryResponse, Product, UpdateProductInput } from '@shared/types/api'
import type { ProductFormValues } from '../schemas/product.schema'

export const productsApi = {
  getAll: (query: string, sort: 'name' | 'newest') => {
    const params = new URLSearchParams({ sort })
    if (query) params.set('query', query)
    return apiClient.get<Product[]>(`/api/products?${params.toString()}`)
  },
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
    apiClient.patch<Product>(`/api/products/${productId}/price`, { defaultSalePrice }),
  merge: (keepId: number, mergeId: number) =>
    apiClient.post<{ success: boolean; keepId: number }>('/api/products/merge', { keepId, mergeId })
}
