import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@shared/lib/query-client'
import { mobileApi } from '../services/mobile.api'

export function useMobileStatus() {
  return useQuery({
    queryKey: queryKeys.mobile.status,
    queryFn: mobileApi.getStatus,
    refetchInterval: 10_000 // picks up phones pairing / LAN address changes
  })
}

export function useMobileDevices(refetchMs: number | false = 10_000) {
  return useQuery({
    queryKey: queryKeys.mobile.devices,
    queryFn: mobileApi.getDevices,
    refetchInterval: refetchMs
  })
}

export function useToggleMobileAccess() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (enable: boolean) => (enable ? mobileApi.enable() : mobileApi.disable()),
    onSuccess: (status) => {
      toast.success(status.enabled ? 'تم تفعيل الاتصال بالهاتف' : 'تم إيقاف الاتصال بالهاتف')
      queryClient.setQueryData(queryKeys.mobile.status, status)
    },
    onError: (error: Error) => toast.error('تعذّر تغيير حالة الاتصال', { description: error.message })
  })
}

export function useCreatePairingCode() {
  return useMutation({
    mutationFn: mobileApi.createPairingCode,
    onError: (error: Error) => toast.error('تعذّر إنشاء رمز الاقتران', { description: error.message })
  })
}

export function useRevokeDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => mobileApi.revokeDevice(id),
    onSuccess: () => {
      toast.success('تم فصل الجهاز — لن يتمكن من الاتصال بعد الآن')
      queryClient.invalidateQueries({ queryKey: queryKeys.mobile.devices })
      queryClient.invalidateQueries({ queryKey: queryKeys.mobile.status })
    },
    onError: (error: Error) => toast.error('تعذّر فصل الجهاز', { description: error.message })
  })
}
