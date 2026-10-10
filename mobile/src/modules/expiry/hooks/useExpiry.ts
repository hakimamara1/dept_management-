import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateExpirationBatchInput, ExpirationBatchStatus, UpdateExpirationBatchInput } from '@desktop-types/api'
import { expiryApi } from '../services/expiry.api'

export const expiryKeys = { list: ['expiry', 'list'] as const }

export const useExpiryBatches = (enabled = true) => useQuery({ queryKey: expiryKeys.list, queryFn: expiryApi.list, enabled })

export function useExpiryMutations() {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['expiry'] })
  return {
    create: useMutation({ mutationFn: ({ data, key }: { data: CreateExpirationBatchInput; key: string }) => expiryApi.create(data, key), onSuccess: refresh }),
    update: useMutation({
      mutationFn: ({ id, data, key }: { id: number; data: UpdateExpirationBatchInput; key: string }) => expiryApi.update(id, data, key),
      onSuccess: refresh
    }),
    setStatus: useMutation({
      mutationFn: ({ id, status, key }: { id: number; status: Extract<ExpirationBatchStatus, 'ACTIVE' | 'SOLD' | 'DISCARDED'>; key: string }) =>
        expiryApi.setStatus(id, status, key),
      onSuccess: refresh
    }),
    remove: useMutation({ mutationFn: ({ id, key }: { id: number; key: string }) => expiryApi.remove(id, key), onSuccess: refresh })
  }
}
