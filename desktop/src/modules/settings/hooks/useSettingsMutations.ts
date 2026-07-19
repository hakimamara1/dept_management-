import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { UpdateBusinessProfileInput } from '@shared/types/api'
import { settingsApi } from '../services/settings.api'

export function useUpdateBusinessProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateBusinessProfileInput) => settingsApi.updateBusinessProfile(data),
    onSuccess: () => {
      toast.success('تم حفظ بيانات الشركة')
      queryClient.invalidateQueries({ queryKey: ['settings', 'business-profile'] })
    },
    onError: (error: Error) => {
      toast.error('فشل حفظ البيانات', { description: error.message })
    }
  })
}

export function useUploadLogo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (file: File) => settingsApi.uploadLogo(file),
    onSuccess: () => {
      toast.success('تم رفع الشعار')
      queryClient.invalidateQueries({ queryKey: ['settings', 'business-profile'] })
    },
    onError: (error: Error) => {
      toast.error('فشل رفع الشعار', { description: error.message })
    }
  })
}

export function useDownloadBackup() {
  return useMutation({
    mutationFn: () => settingsApi.downloadBackup(),
    onError: (error: Error) => {
      toast.error('فشل تنزيل النسخة الاحتياطية', { description: error.message })
    }
  })
}

export function useRestoreBackup() {
  return useMutation({
    mutationFn: (file: File) => settingsApi.restoreBackup(file),
    onSuccess: () => {
      toast.success('تمت الاستعادة بنجاح — أعد تشغيل التطبيق الآن لتفعيل البيانات المستعادة', { duration: 10000 })
    },
    onError: (error: Error) => {
      toast.error('فشلت الاستعادة', { description: error.message })
    }
  })
}
