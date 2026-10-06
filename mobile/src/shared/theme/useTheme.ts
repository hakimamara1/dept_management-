import { useColorScheme } from 'react-native'
import { darkColors, lightColors, type Colors } from './colors'

export function useTheme(): { colors: Colors; isDark: boolean } {
  const isDark = useColorScheme() === 'dark'
  return { colors: isDark ? darkColors : lightColors, isDark }
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const
export const radius = { sm: 6, md: 10, lg: 14 } as const
// Android minimum comfortable touch target.
export const MIN_TOUCH = 48
