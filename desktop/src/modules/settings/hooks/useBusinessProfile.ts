import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '../services/settings.api'

export function useBusinessProfile() {
  return useQuery({
    queryKey: ['settings', 'business-profile'],
    queryFn: () => settingsApi.getBusinessProfile()
  })
}
