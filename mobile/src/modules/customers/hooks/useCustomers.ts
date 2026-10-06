import { useQuery } from '@tanstack/react-query'
import { customersApi } from '../services/customers.api'

export const customerKeys = {
  list: (query: string) => ['customers', 'list', query] as const,
  detail: (id: number) => ['customers', 'detail', id] as const,
  statement: (id: number) => ['customers', 'statement', id] as const
}

export const useCustomers = (query: string) =>
  useQuery({ queryKey: customerKeys.list(query), queryFn: () => customersApi.list(query) })

export const useCustomer = (id: number) =>
  useQuery({ queryKey: customerKeys.detail(id), queryFn: () => customersApi.getById(id) })

export const useCustomerStatement = (id: number) =>
  useQuery({ queryKey: customerKeys.statement(id), queryFn: () => customersApi.getStatement(id) })
