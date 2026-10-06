import * as Updates from 'expo-updates'

/** Reloads the JS bundle so a changed layout direction (RTL ↔ LTR) takes effect. Returns false if the platform refuses. */
export async function restartApp(): Promise<boolean> {
  try {
    await Updates.reloadAsync()
    return true
  } catch {
    return false
  }
}
