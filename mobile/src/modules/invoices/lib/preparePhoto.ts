import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'

/**
 * A phone photo is 3–8 MB; the server accepts 10 MB and the AI doesn't need more than ~1600 px to read
 * printed or handwritten lines. Downscale + JPEG-compress before uploading over Wi-Fi.
 */
export async function preparePhoto(uri: string): Promise<{ uri: string; name: string; type: string }> {
  const rendered = await ImageManipulator.manipulate(uri).resize({ width: 1600 }).renderAsync()
  const saved = await rendered.saveAsync({ compress: 0.7, format: SaveFormat.JPEG })
  return { uri: saved.uri, name: `invoice-${Date.now()}.jpg`, type: 'image/jpeg' }
}
