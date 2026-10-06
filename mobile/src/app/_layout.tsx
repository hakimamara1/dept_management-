import { useEffect, useRef } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError } from '@/shared/api/client'
import { useTheme } from '@/shared/theme/useTheme'
import { reconnect } from '@/modules/connection/services/connectionManager'
import { useConnectionBootstrap } from '@/modules/connection/hooks/useConnectionBootstrap'
import { useConnectionStore } from '@/modules/connection/store'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000, refetchOnReconnect: true } },
  queryCache: new QueryCache({
    // A failed read usually means the desktop went away — re-probe it (and mDNS) so the
    // "desktop not reachable" screen appears, or the app heals itself if it was a blip.
    onError: (error) => {
      if (error instanceof ApiError && (error.code === 'NETWORK' || error.code === 'TIMEOUT')) reconnect()
    }
  })
})

/** Sends the user to the right screen for the connection state; never traps them on a stale one. */
function useConnectionRouting() {
  const status = useConnectionStore((s) => s.status)
  const router = useRouter()
  const segments = useSegments()
  const first = segments[0] as string | undefined

  useEffect(() => {
    if (status === 'loading' || status === 'connecting') return
    if (status === 'unpaired') {
      if (first !== 'pair') router.replace('/pair')
    } else if (status === 'connected') {
      if (!first || first === 'pair' || first === 'connect-error') router.replace('/(tabs)/home')
    } else if (first !== 'connect-error' && first !== 'pair') {
      router.replace('/connect-error')
    }
  }, [status, first, router])
}

function Root() {
  useConnectionBootstrap()
  useConnectionRouting()
  const { colors, isDark } = useTheme()
  const status = useConnectionStore((s) => s.status)
  const connectedOnce = useRef(false)
  if (status === 'connected') connectedOnce.current = true
  // Only block the UI during the very first check; later re-checks happen quietly behind it.
  const booting = status === 'loading' || (status === 'connecting' && !connectedOnce.current)

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
      {booting && (
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </View>
  )
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  )
}
