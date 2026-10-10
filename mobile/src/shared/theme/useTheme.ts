import { useColorScheme } from 'react-native'
import { darkColors, lightColors, type Colors } from './colors'

export function useTheme(): { colors: Colors; isDark: boolean } {
  const isDark = useColorScheme() === 'dark'
  return { colors: isDark ? darkColors : lightColors, isDark }
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const
export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const
/** Soft card shadow in light mode; dark mode relies on the border instead. */
export const elevation = {
  card: { shadowColor: '#1c1b17', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 }
} as const
// Android minimum comfortable touch target.
export const MIN_TOUCH = 48
