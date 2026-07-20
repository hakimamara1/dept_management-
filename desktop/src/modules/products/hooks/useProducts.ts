import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-client'
import { useDebouncedValue } from '@shared/hooks/useDebouncedValue'
import { productsApi } from '../services/products.api'

export type ProductSort = 'name' | 'newest'

export function useProducts(rawQuery: string, sort: ProductSort) {
  const query = useDebouncedValue(rawQuery.trim(), 300)

  return useQuery({
    queryKey: queryKeys.products.all(query, sort),
    queryFn: () => productsApi.getAll(query, sort)
  })
}
