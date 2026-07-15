import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-client'
import { useDebouncedValue } from '@shared/hooks/useDebouncedValue'
import { suppliersApi } from '../services/suppliers.api'

export function useSuppliers(rawQuery: string) {
  const query = useDebouncedValue(rawQuery.trim(), 300)

  return useQuery({
    queryKey: queryKeys.suppliers.list(query),
    queryFn: () => suppliersApi.list(query)
  })
}

export function useSupplierAging() {
  return useQuery({
    queryKey: queryKeys.suppliers.aging,
    queryFn: suppliersApi.getAging
  })
}
