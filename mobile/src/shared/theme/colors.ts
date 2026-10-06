// Same palette as the desktop app (desktop/src/app/styles/globals.css): deep teal on a warm neutral ground.
export const lightColors = {
  background: '#fafaf8',
  foreground: '#1c1b17',
  card: '#ffffff',
  primary: '#0f7a73',
  primaryForeground: '#ffffff',
  muted: '#f0efe9',
  mutedForeground: '#726f63',
  accent: '#e7f3f1',
  accentForeground: '#0f7a73',
  destructive: '#b3261e',
  success: '#1c7c4b',
  warning: '#b8720a',
  border: '#e4e2d9'
}

export const darkColors: typeof lightColors = {
  background: '#15171a',
  foreground: '#ecebe6',
  card: '#1b1e22',
  primary: '#2fbbaf',
  primaryForeground: '#06201d',
  muted: '#22262b',
  mutedForeground: '#9a9990',
  accent: '#16302e',
  accentForeground: '#6fdcd1',
  destructive: '#e5534b',
  success: '#34c77b',
  warning: '#e2a93b',
  border: '#2a2d31'
}

export type Colors = typeof lightColors
