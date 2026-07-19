import { API_BASE_URL, apiClient } from '@shared/lib/api-client'
import type { BusinessProfile, UpdateBusinessProfileInput } from '@shared/types/api'

export const settingsApi = {
  getBusinessProfile: () => apiClient.get<BusinessProfile>('/api/settings/business-profile'),
  updateBusinessProfile: (data: UpdateBusinessProfileInput) =>
    apiClient.patch<BusinessProfile>('/api/settings/business-profile', data),
  uploadLogo: (file: File) => {
    const formData = new FormData()
    formData.append('logo', file)
    return apiClient.postForm<BusinessProfile>('/api/settings/business-profile/logo', formData)
  },

  // Bypasses the shared JSON-only apiClient — this is a binary download,
  // triggered the same way DataTable.tsx's own exportCsv() already does
  // (Blob URL + a synthesized <a> click) rather than a new mechanism.
  downloadBackup: async () => {
    const res = await fetch(`${API_BASE_URL}/api/settings/backup`)
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      throw new Error(body.error ?? `HTTP ${res.status}`)
    }
    const blob = await res.blob()
    const dateStamp = new Date().toISOString().slice(0, 10)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `spice-erp-backup-${dateStamp}.db`
    link.click()
    URL.revokeObjectURL(url)
  },

  restoreBackup: (file: File) => {
    const formData = new FormData()
    formData.append('backup', file)
    return apiClient.postForm<{ success: boolean; requiresRestart: boolean }>('/api/settings/restore', formData)
  }
}
