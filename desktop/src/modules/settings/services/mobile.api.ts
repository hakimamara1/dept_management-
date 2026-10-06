import { apiClient } from '@shared/lib/api-client'
import type { MobileDevice, MobilePairingCode, MobileStatus } from '@shared/types/api'

/** Owner-only controls — the backend only accepts these from this PC (loopback). */
export const mobileApi = {
  getStatus: () => apiClient.get<MobileStatus>('/api/mobile/status'),
  enable: () => apiClient.post<MobileStatus>('/api/mobile/enable'),
  disable: () => apiClient.post<MobileStatus>('/api/mobile/disable'),
  createPairingCode: () => apiClient.post<MobilePairingCode>('/api/mobile/pairing-code'),
  getDevices: () => apiClient.get<MobileDevice[]>('/api/mobile/devices'),
  revokeDevice: (id: number) => apiClient.delete<{ success: boolean }>(`/api/mobile/devices/${id}`)
}
