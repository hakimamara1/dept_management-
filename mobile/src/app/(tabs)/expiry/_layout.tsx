import { Stack } from 'expo-router'

// Single list screen; detail and forms are sheets, so no header chrome is needed here.
export default function ExpiryLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
