import { api } from '@/shared/api/client'
import type { PriceHistoryResponse, Product, SalesPriceHistoryResponse, UpdateProductInput } from '@desktop-types/api'

export interface CreateProductInput {
  name: string
  unit?: string
  barcode?: string
  category?: string
  defaultSalePrice?: number
}

export const productsApi = {
  /** Picker search: capped, and one product can come back several times (alias join) — callers dedupe by id. */
  search: (query: string) => api.get<Product[]>(`/api/products/search?query=${encodeURIComponent(query)}`),
  list: (query = '') => api.get<Product[]>(`/api/products${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  /** Exact barcode match (products are unique enough by code); empty array when nothing has it. */
  byBarcode: (barcode: string) => api.get<Product[]>(`/api/products?barcode=${encodeURIComponent(barcode)}`),
  get: (id: number) => api.get<Product>(`/api/products/${id}`),
  priceHistory: (id: number) => api.get<PriceHistoryResponse>(`/api/products/${id}/price-history`),
  salesPriceHistory: (id: number) => api.get<SalesPriceHistoryResponse>(`/api/products/${id}/sales-price-history`),
  create: (data: CreateProductInput, key: string) => api.post<{ id: number }>('/api/products', data, { idempotencyKey: key }),
  update: (id: number, data: UpdateProductInput, key: string) => api.patch<Product>(`/api/products/${id}`, data, { idempotencyKey: key }),
  setSalePrice: (id: number, defaultSalePrice: number, key: string) =>
    api.patch<Product>(`/api/products/${id}/price`, { defaultSalePrice }, { idempotencyKey: key })
}
