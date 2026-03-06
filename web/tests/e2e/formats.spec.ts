import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dirname, '../fixtures')

/**
 * Format output verification tests.
 *
 * Calls the WASM converter directly via `window.__converter` (bypassing the UI)
 * to verify that each supported output format produces bytes with the correct
 * magic header. Also covers ICO dimension enforcement and a round-trip smoke
 * test across all tier-2 formats.
 */
test.describe('Tier-2 format conversions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => !!window.__converter)
    await page.evaluate(() => window.__converter.ensureReady())
  })

  test('PNG → WebP produces valid WebP output', async ({ page }) => {
    const pngBytes = Array.from(readFileSync(join(FIXTURES, 'test.png')))

    const result = await page.evaluate(async (bytes: number[]) => {
      const data = new Uint8Array(bytes)
      const { data: output, conversionMs } = await window.__converter.convertImageTimed(
        data,
        'webp',
      )
      return { size: output.byteLength, conversionMs, header: Array.from(output.slice(0, 12)) }
    }, pngBytes)

    expect(result.size).toBeGreaterThan(0)
    // RIFF header at bytes 0–3
    expect(result.header.slice(0, 4)).toEqual([0x52, 0x49, 0x46, 0x46]) // "RIFF"
    // WebP signature at bytes 8–11
    expect(result.header.slice(8, 12)).toEqual([0x57, 0x45, 0x42, 0x50]) // "WEBP"

    console.log(
      `[PERF] PNG → WebP | conversion: ${result.conversionMs} ms | output: ${result.size} bytes`,
    )
  })

  test('PNG → TIFF produces valid TIFF output', async ({ page }) => {
    const pngBytes = Array.from(readFileSync(join(FIXTURES, 'test.png')))

    const result = await page.evaluate(async (bytes: number[]) => {
      const data = new Uint8Array(bytes)
      const { data: output, conversionMs } = await window.__converter.convertImageTimed(
        data,
        'tiff',
      )
      return { size: output.byteLength, conversionMs, header: Array.from(output.slice(0, 4)) }
    }, pngBytes)

    expect(result.size).toBeGreaterThan(0)
    // TIFF magic: II 2A 00 (little-endian) or MM 00 2A (big-endian)
    const isLE =
      result.header[0] === 0x49 &&
      result.header[1] === 0x49 &&
      result.header[2] === 0x2a &&
      result.header[3] === 0x00
    const isBE =
      result.header[0] === 0x4d &&
      result.header[1] === 0x4d &&
      result.header[2] === 0x00 &&
      result.header[3] === 0x2a
    expect(isLE || isBE).toBe(true)

    console.log(
      `[PERF] PNG → TIFF | conversion: ${result.conversionMs} ms | output: ${result.size} bytes`,
    )
  })

  test('PNG → ICO produces valid ICO output', async ({ page }) => {
    // ICO supports a maximum dimension of 256×256.
    // test.png is expected to be within that limit.
    const pngBytes = Array.from(readFileSync(join(FIXTURES, 'test.png')))

    const result = await page.evaluate(async (bytes: number[]) => {
      const data = new Uint8Array(bytes)
      const { data: output, conversionMs } = await window.__converter.convertImageTimed(data, 'ico')
      return { size: output.byteLength, conversionMs, header: Array.from(output.slice(0, 4)) }
    }, pngBytes)

    expect(result.size).toBeGreaterThan(0)
    // ICO magic: 00 00 01 00
    expect(result.header).toEqual([0x00, 0x00, 0x01, 0x00])

    console.log(
      `[PERF] PNG → ICO | conversion: ${result.conversionMs} ms | output: ${result.size} bytes`,
    )
  })

  test('ICO conversion of image exceeding 256px returns descriptive error', async ({ page }) => {
    // Generate a 300×300 PNG in-page via canvas — large enough to exceed ICO's
    // 256px limit but small enough that WASM decoding won't OOM.
    const errorMessage = await page.evaluate(async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 300
      canvas.height = 300
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ff0000'
      ctx.fillRect(0, 0, 300, 300)
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/png'),
      )
      const buf = await blob.arrayBuffer()
      const data = new Uint8Array(buf)
      try {
        await window.__converter.convertImageTimed(data, 'ico')
        return null
      } catch (e) {
        return e instanceof Error ? e.message : String(e)
      }
    })

    expect(errorMessage).not.toBeNull()
    expect(errorMessage).toMatch(/width|height|256|parameter|malformed/i)

    console.log(`[E2E] ICO oversized error: "${errorMessage}"`)
  })

  test('PNG → TGA produces non-zero output', async ({ page }) => {
    // TGA has no magic bytes, so we only verify the output is non-empty.
    const pngBytes = Array.from(readFileSync(join(FIXTURES, 'test.png')))

    const result = await page.evaluate(async (bytes: number[]) => {
      const data = new Uint8Array(bytes)
      const { data: output, conversionMs } = await window.__converter.convertImageTimed(data, 'tga')
      return { size: output.byteLength, conversionMs }
    }, pngBytes)

    expect(result.size).toBeGreaterThan(0)

    console.log(
      `[PERF] PNG → TGA | conversion: ${result.conversionMs} ms | output: ${result.size} bytes`,
    )
  })

  test('PNG → QOI produces valid QOI output', async ({ page }) => {
    const pngBytes = Array.from(readFileSync(join(FIXTURES, 'test.png')))

    const result = await page.evaluate(async (bytes: number[]) => {
      const data = new Uint8Array(bytes)
      const { data: output, conversionMs } = await window.__converter.convertImageTimed(data, 'qoi')
      return { size: output.byteLength, conversionMs, header: Array.from(output.slice(0, 4)) }
    }, pngBytes)

    expect(result.size).toBeGreaterThan(0)
    // QOI magic: "qoif" = 71 6F 69 66
    expect(result.header).toEqual([0x71, 0x6f, 0x69, 0x66])

    console.log(
      `[PERF] PNG → QOI | conversion: ${result.conversionMs} ms | output: ${result.size} bytes`,
    )
  })

  test('All tier-2 formats round-trip: output is non-zero for each', async ({ page }) => {
    const pngBytes = Array.from(readFileSync(join(FIXTURES, 'test.png')))
    const formats = ['webp', 'tiff', 'tga', 'qoi', 'bmp']

    const results = await page.evaluate(
      async ({ bytes, formats }: { bytes: number[]; formats: string[] }) => {
        const data = new Uint8Array(bytes)
        const out: Record<string, number> = {}
        for (const fmt of formats) {
          const { data: output } = await window.__converter.convertImageTimed(data, fmt)
          out[fmt] = output.byteLength
        }
        return out
      },
      { bytes: pngBytes, formats },
    )

    for (const fmt of formats) {
      expect(results[fmt], `${fmt} output should be non-zero`).toBeGreaterThan(0)
      console.log(`[PERF] PNG → ${fmt.toUpperCase()} | output: ${results[fmt]} bytes`)
    }
  })
})
