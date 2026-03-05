import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isHeicMagicBytes, normalizeHeic } from '../heic'

// ---------------------------------------------------------------------------
// isHeicMagicBytes
// ---------------------------------------------------------------------------

describe('isHeicMagicBytes', () => {
  function makeHeicBytes(brand: string): Uint8Array {
    // ISOBMFF layout: [4-byte size][4-byte "ftyp"][4-byte brand]
    const bytes = new Uint8Array(12)
    // size (irrelevant for detection)
    bytes[0] = 0
    bytes[1] = 0
    bytes[2] = 0
    bytes[3] = 24
    // "ftyp"
    bytes[4] = 0x66 // f
    bytes[5] = 0x74 // t
    bytes[6] = 0x79 // y
    bytes[7] = 0x70 // p
    // brand
    for (let i = 0; i < 4; i++) {
      bytes[8 + i] = brand.charCodeAt(i)
    }
    return bytes
  }

  it('returns true for heic brand', () => {
    expect(isHeicMagicBytes(makeHeicBytes('heic'))).toBe(true)
  })

  it('returns true for heix brand', () => {
    expect(isHeicMagicBytes(makeHeicBytes('heix'))).toBe(true)
  })

  it('returns true for hevc brand', () => {
    expect(isHeicMagicBytes(makeHeicBytes('hevc'))).toBe(true)
  })

  it('returns true for mif1 brand', () => {
    expect(isHeicMagicBytes(makeHeicBytes('mif1'))).toBe(true)
  })

  it('returns true for msf1 brand', () => {
    expect(isHeicMagicBytes(makeHeicBytes('msf1'))).toBe(true)
  })

  it('returns false for a PNG header', () => {
    // PNG magic: 89 50 4E 47 0D 0A 1A 0A ...
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d])
    expect(isHeicMagicBytes(png)).toBe(false)
  })

  it('returns false for a JPEG header', () => {
    // JPEG magic: FF D8 FF ...
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])
    expect(isHeicMagicBytes(jpeg)).toBe(false)
  })

  it('returns false for a WebP header', () => {
    // RIFF....WEBP
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])
    expect(isHeicMagicBytes(webp)).toBe(false)
  })

  it('returns false when "ftyp" is absent', () => {
    const bytes = new Uint8Array(12)
    // Write heic brand at offset 8 but wrong bytes at 4–7
    bytes[8] = 0x68 // h
    bytes[9] = 0x65 // e
    bytes[10] = 0x69 // i
    bytes[11] = 0x63 // c
    expect(isHeicMagicBytes(bytes)).toBe(false)
  })

  it('returns false for buffers shorter than 12 bytes', () => {
    expect(isHeicMagicBytes(new Uint8Array(8))).toBe(false)
    expect(isHeicMagicBytes(new Uint8Array(0))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// normalizeHeic — pass-through for non-HEIC files
// ---------------------------------------------------------------------------

describe('normalizeHeic', () => {
  beforeEach(() => {
    // Ensure createImageBitmap is not available so we don't try the native path
    vi.stubGlobal('createImageBitmap', undefined)
  })

  it('returns the original File unchanged when it is not HEIC', async () => {
    // PNG magic bytes
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d])
    const pngFile = new File([pngBytes], 'photo.png', { type: 'image/png' })

    const result = await normalizeHeic(pngFile)

    expect(result).toBe(pngFile)
  })

  it('returns the original File unchanged when it is a JPEG', async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])
    const jpegFile = new File([jpegBytes], 'photo.jpg', { type: 'image/jpeg' })

    const result = await normalizeHeic(jpegFile)

    expect(result).toBe(jpegFile)
  })

  it('returns the original File unchanged for a buffer shorter than 12 bytes', async () => {
    const tinyFile = new File([new Uint8Array(4)], 'tiny.bin', { type: 'application/octet-stream' })

    const result = await normalizeHeic(tinyFile)

    expect(result).toBe(tinyFile)
  })
})
