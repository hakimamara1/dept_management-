import { api } from '@/shared/api/client'
import type { Product } from '@desktop-types/api'

export const productsApi = {
  /** The search route joins aliases, so one product can come back several times — callers dedupe by id. */
  search: (query: string) => api.get<Product[]>(`/api/products/search?query=${encodeURIComponent(query)}`)
}
