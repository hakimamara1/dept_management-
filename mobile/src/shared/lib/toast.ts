import { Platform, ToastAndroid } from 'react-native'

type HapticsModule = typeof import('expo-haptics')

// Loaded defensively: a build without the native module (older dev client, Expo Go variants) must not crash on a toast.
let Haptics: HapticsModule | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Haptics = require('expo-haptics') as HapticsModule
} catch {
  Haptics = null
}

/** A short confirmation: the toast text plus a light "success" buzz so a money action is felt as well as seen. */
export function toast(message: string) {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT)
  Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
}
