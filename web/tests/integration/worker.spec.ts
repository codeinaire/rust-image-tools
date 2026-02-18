import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'

const FIXTURES = join(__dirname, '../fixtures')

// Type alias for the converter exposed on window by main.ts
type Converter = {
  ensureReady: () => Promise<number>
  detectFormat: (data: Uint8Array) => Promise<string>
  convertImageTimed: (
    data: Uint8Array,
    fmt: string,
  ) => Promise<{ data: Uint8Array; conversionMs: number }>
  getDimensions: (data: Uint8Array) => Promise<{ width: number; height: number }>
}

declare global {
  interface Window {
    __converter: Converter
  }
}

test.describe('Worker lifecycle', () => {
  test('WASM initializes in Worker without errors', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (err) => pageErrors.push(err.message))

    await page.goto('/')

    // Wait until converter is ready (WASM loaded in Worker)
    const initMs = await page.evaluate(async () => {
      return await window.__converter.ensureReady()
    })

    expect(typeof initMs).toBe('number')
    expect(initMs).toBeGreaterThanOrEqual(0)
    expect(pageErrors).toHaveLength(0)

    console.log(`[WORKER] WASM init: ${initMs} ms`)
  })

  test('Worker responds to conversion message — PNG → JPEG', async ({ page }) => {
    await page.goto('/')

    const pngBytes = Array.from(readFileSync(join(FIXTURES, 'test.png')))

    const result = await page.evaluate(async (bytes: number[]) => {
      const data = new Uint8Array(bytes)
      const initMs = await window.__converter.ensureReady()
      const pipelineStart = performance.now()
      const { data: output, conversionMs } = await window.__converter.convertImageTimed(
        data,
        'jpeg',
      )
      const totalMs = Math.round(performance.now() - pipelineStart)
      return {
        outputSize: output.byteLength,
        conversionMs,
        totalMs,
        initMs,
      }
    }, pngBytes)

    expect(result.outputSize).toBeGreaterThan(0)
    expect(result.conversionMs).toBeGreaterThanOrEqual(0)

    console.log(
      `[PERF WORKER] PNG → JPEG | worker_init: ${result.initMs} ms | conversion: ${result.conversionMs} ms | total: ${result.totalMs} ms`,
    )
  })

  test('Worker returns structured error for invalid bytes', async ({ page }) => {
    await page.goto('/')

    const errorMessage = await page.evaluate(async () => {
      await window.__converter.ensureReady()
      const garbage = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0x00])
      try {
        await window.__converter.convertImageTimed(garbage, 'jpeg')
        return null // should not reach here
      } catch (e) {
        return e instanceof Error ? e.message : String(e)
      }
    })

    expect(errorMessage).not.toBeNull()
    expect(typeof errorMessage).toBe('string')
    expect(errorMessage!.length).toBeGreaterThan(0)

    console.log(`[WORKER] Error for invalid bytes: "${errorMessage}"`)
  })

  test('Multiple sequential conversions work without stale state', async ({ page }) => {
    await page.goto('/')

    const pngBytes = Array.from(readFileSync(join(FIXTURES, 'test.png')))

    const results = await page.evaluate(async (bytes: number[]) => {
      await window.__converter.ensureReady()
      const outputs: number[] = []
      for (let i = 0; i < 3; i++) {
        const data = new Uint8Array(bytes)
        const { data: result } = await window.__converter.convertImageTimed(data, 'jpeg')
        outputs.push(result.byteLength)
      }
      return outputs
    }, pngBytes)

    expect(results).toHaveLength(3)
    for (const size of results) {
      expect(size).toBeGreaterThan(0)
    }
    // All conversions of the same input should produce the same output size
    expect(results[0]).toBe(results[1])
    expect(results[1]).toBe(results[2])

    console.log(`[WORKER] Sequential conversions: ${results.join(', ')} bytes each`)
  })

  test('Worker handles large transfer via transferable objects', async ({ page }) => {
    await page.goto('/')

    // Send 50 MB of zeros — invalid image data, so conversion will fail,
    // but the important thing is the buffer is transferred without error/hang.
    const errorOrNull = await page.evaluate(async () => {
      await window.__converter.ensureReady()
      // 50 MB buffer
      const largeBuf = new Uint8Array(50 * 1024 * 1024)
      try {
        await window.__converter.convertImageTimed(largeBuf, 'jpeg')
        return null
      } catch (e) {
        return e instanceof Error ? e.message : String(e)
      }
    })

    // We expect an error (garbage input), but NOT a crash, hang, or OOM
    expect(typeof errorOrNull).toBe('string')
    expect((errorOrNull as string).length).toBeGreaterThan(0)

    console.log(`[WORKER] Large-buffer transfer error (expected): "${errorOrNull}"`)
  })
})
