import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UpdateProductInput } from '@desktop-types/api'
import { productsApi, type CreateProductInput } from '../services/products.api'

export const productKeys = {
  list: (query: string) => ['products', 'list', query] as const,
  detail: (id: number) => ['products', 'detail', id] as const,
  buyHistory: (id: number) => ['products', 'buy-history', id] as const,
  sellHistory: (id: number) => ['products', 'sell-history', id] as const
}

export const useProducts = (query: string) => useQuery({ queryKey: productKeys.list(query), queryFn: () => productsApi.list(query) })
export const useProduct = (id: number) => useQuery({ queryKey: productKeys.detail(id), queryFn: () => productsApi.get(id) })
export const useBuyHistory = (id: number) => useQuery({ queryKey: productKeys.buyHistory(id), queryFn: () => productsApi.priceHistory(id) })
export const useSellHistory = (id: number) => useQuery({ queryKey: productKeys.sellHistory(id), queryFn: () => productsApi.salesPriceHistory(id) })

/** A product change also changes pickers and the review screen's suggestions, so refresh every products query. */
export function useProductMutations() {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['products'] })
  return {
    create: useMutation({ mutationFn: ({ data, key }: { data: CreateProductInput; key: string }) => productsApi.create(data, key), onSuccess: refresh }),
    update: useMutation({
      mutationFn: ({ id, data, key }: { id: number; data: UpdateProductInput; key: string }) => productsApi.update(id, data, key),
      onSuccess: refresh
    }),
    setSalePrice: useMutation({
      mutationFn: ({ id, price, key }: { id: number; price: number; key: string }) => productsApi.setSalePrice(id, price, key),
      onSuccess: refresh
    })
  }
}
