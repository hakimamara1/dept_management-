import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@shared/lib/api-client'

interface HealthResponse {
  status: string
  database: string
  timestamp: string
}

/**
 * Polls the backend's /health endpoint so the UI can show a real
 * connection/offline indicator instead of silently failing requests.
 */
export function useBackendHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.get<HealthResponse>('/health'),
    refetchInterval: 15_000,
    retry: false,
    staleTime: 0
  })
}
