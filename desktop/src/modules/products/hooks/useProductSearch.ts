import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-client'
import { useDebouncedValue } from '@shared/hooks/useDebouncedValue'
import { productsApi } from '../services/products.api'

export function useProductSearch(rawQuery: string) {
  const query = useDebouncedValue(rawQuery.trim(), 300)

  return useQuery({
    queryKey: queryKeys.products.search(query),
    queryFn: () => productsApi.search(query),
    enabled: query.length > 0
  })
}
