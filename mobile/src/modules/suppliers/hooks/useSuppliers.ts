import { useQuery } from '@tanstack/react-query'
import { suppliersApi } from '../services/suppliers.api'

export const supplierKeys = {
  list: (query: string) => ['suppliers', 'list', query] as const,
  detail: (id: number) => ['suppliers', 'detail', id] as const,
  ledger: (id: number) => ['suppliers', 'ledger', id] as const
}

export const useSuppliers = (query: string) =>
  useQuery({ queryKey: supplierKeys.list(query), queryFn: () => suppliersApi.list(query) })

export const useSupplier = (id: number) =>
  useQuery({ queryKey: supplierKeys.detail(id), queryFn: () => suppliersApi.getById(id) })

export const useSupplierLedger = (id: number) =>
  useQuery({ queryKey: supplierKeys.ledger(id), queryFn: () => suppliersApi.getLedger(id) })
