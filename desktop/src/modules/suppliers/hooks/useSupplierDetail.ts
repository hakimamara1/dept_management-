import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-client'
import { suppliersApi } from '../services/suppliers.api'

export function useSupplier(id: number) {
  return useQuery({
    queryKey: queryKeys.suppliers.detail(id),
    queryFn: () => suppliersApi.getById(id)
  })
}

export function useSupplierLedger(id: number) {
  return useQuery({
    queryKey: queryKeys.suppliers.ledger(id),
    queryFn: () => suppliersApi.getLedger(id)
  })
}
