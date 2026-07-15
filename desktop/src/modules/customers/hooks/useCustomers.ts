import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-client'
import { useDebouncedValue } from '@shared/hooks/useDebouncedValue'
import { customersApi } from '../services/customers.api'

export function useCustomers(rawQuery: string) {
  const query = useDebouncedValue(rawQuery.trim(), 300)

  return useQuery({
    queryKey: queryKeys.customers.list(query),
    queryFn: () => customersApi.list(query)
  })
}
