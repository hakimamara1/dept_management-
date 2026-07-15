import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-client'
import { productsApi } from '../services/products.api'

export function useProductPriceHistory(productId: number | null) {
  return useQuery({
    queryKey: queryKeys.products.priceHistory(productId ?? -1),
    queryFn: () => productsApi.getPriceHistory(productId as number),
    enabled: productId != null
  })
}
