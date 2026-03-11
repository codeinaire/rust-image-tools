/**
 * HEIC/HEIF detection and normalisation utilities.
 *
 * HEIC cannot be decoded inside the Rust/WASM pipeline because the `image`
 * crate has no HEIC support and no viable pure-Rust HEVC decoder exists.
 * Instead, this module handles HEIC as a JS-side pre-processing step:
 *
 * 1. Fast magic-byte check avoids loading any library for non-HEIC files.
 * 2. On Safari 17+, `createImageBitmap()` decodes HEIC natively — no library download.
 * 3. On other browsers, `heic-to` (which wraps libheif compiled to WASM) is
 *    lazy-loaded only when a HEIC file is actually detected.
 *
 * The output is always a PNG `File` that can be passed directly into the
 * existing Rust/WASM conversion pipeline unchanged.
 */

/**
 * Check HEIF/HEIC magic bytes without loading any external library.
 *
 * HEIF files are ISO Base Media File Format (ISOBMFF) containers. The first
 * 4 bytes are a box size, bytes 4–7 are the ASCII string "ftyp", and bytes
 * 8–11 are the brand code that identifies the specific HEIF variant.
 */
export function isHeicMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) {
    return false
  }

  const ftyp = String.fromCharCode(
    bytes[4] as number,
    bytes[5] as number,
    bytes[6] as number,
    bytes[7] as number,
  )
  if (ftyp !== 'ftyp') {
    return false
  }

  const brand = String.fromCharCode(
    bytes[8] as number,
    bytes[9] as number,
    bytes[10] as number,
    bytes[11] as number,
  )
  const heicBrands = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'MiHE']
  return heicBrands.includes(brand)
}

/**
 * Attempt to decode a HEIC file using the browser's native image decoder
 * (Safari 17+). Draws to an off-screen canvas and exports as PNG.
 *
 * Returns `null` if the browser does not support native HEIC decoding.
 */
async function tryNativeDecode(file: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return null
    }

    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()

    return await new Promise<File | null>((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(null)
          return
        }
        const pngName = file.name.replace(/\.heic?$/i, '.png')
        resolve(new File([blob], pngName, { type: 'image/png' }))
      }, 'image/png')
    })
  } catch {
    // createImageBitmap throws for unsupported types on non-Safari browsers
    return null
  }
}

/**
 * Normalise a file for the Rust/WASM conversion pipeline.
 *
 * If the file is HEIC/HEIF, it is decoded to a PNG `File` using either:
 * - Safari 17+ native `createImageBitmap()` (preferred — no download cost), or
 * - the `heic-to` npm package, lazy-loaded only when needed (2–4 MB WASM binary).
 *
 * If the file is not HEIC, it is returned unchanged.
 */
export async function normalizeHeic(file: File): Promise<File> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  if (!isHeicMagicBytes(bytes)) {
    return file
  }

  // Try the native browser path first — Safari 17+ supports HEIC in createImageBitmap.
  // This avoids downloading the heic-to WASM binary entirely for Safari users,
  // who are the primary source of HEIC files (iPhone default camera format).
  const nativeResult = await tryNativeDecode(file)
  if (nativeResult) {
    return nativeResult
  }

  // Lazy-load heic-to only now — the 2–4 MB WASM binary is not downloaded
  // until we know the user actually has a HEIC file on a non-Safari browser.
  const { isHeic, heicTo } = await import('heic-to')

  const confirmed = await isHeic(file)
  if (!confirmed) {
    return file
  }

  const pngBlob = await heicTo({ blob: file, type: 'image/png', quality: 1 })
  const pngName = file.name.replace(/\.heic?$/i, '.png')
  return new File([pngBlob], pngName, { type: 'image/png' })
}
