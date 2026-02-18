import { test, expect } from '@playwright/test'
import { join } from 'path'

const FIXTURES = join(__dirname, '../fixtures')

test.describe('Validation guards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(async () => window.__converter.ensureReady())
  })

  // ── File size limit ──────────────────────────────────────────────────────

  test('File > 200 MB is rejected before Worker, error is shown', async ({ page }) => {
    // Simulate a large file via a drop event with a fake File whose .size reports 201 MB.
    // We override the size property via a crafted object URL so the size check triggers
    // before any bytes reach the Worker.
    await page.evaluate(async () => {
      const MAX_MB = 200
      // Build a File whose reported size exceeds the limit.
      // The actual data is tiny; we patch the `size` property via Object.defineProperty
      // so the validation branch fires without allocating 201 MB.
      const smallBytes = new Uint8Array(4)
      const file = new File([smallBytes], 'huge.png', { type: 'image/png' })
      Object.defineProperty(file, 'size', { value: (MAX_MB + 1) * 1024 * 1024, writable: false })

      const dt = new DataTransfer()
      dt.items.add(file)
      document
        .getElementById('drop-zone')!
        .dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }))
    })

    await expect(page.locator('#error-display')).not.toHaveClass(/hidden/, { timeout: 5_000 })

    const errorText = await page.locator('#error-message').textContent()
    expect(errorText).toMatch(/too large/i)
    expect(errorText).toMatch(/200/)  // matches "200 MB" or "200.0 MB"

    // Convert button should still be disabled (file not accepted)
    await expect(page.locator('#convert-btn')).toBeDisabled()

    console.log(`[VALIDATION] File-too-large error: "${errorText}"`)
  })

  // ── Dimension limit ──────────────────────────────────────────────────────

  test('Image > 100 MP is rejected after dimension check, error is shown', async ({ page }) => {
    // test-huge.png has IHDR declaring 10001x10001 (≈ 100.02 MP > 100 MP limit).
    // The dimension check runs in the Worker via get_dimensions(); the file is small
    // because PNG compression collapses the single white scanline.
    await page.locator('#file-input').setInputFiles(join(FIXTURES, 'test-huge.png'))

    await expect(page.locator('#error-display')).not.toHaveClass(/hidden/, { timeout: 15_000 })

    const errorText = await page.locator('#error-message').textContent()
    expect(errorText).toMatch(/too large/i)
    // Should mention megapixels or MP
    expect(errorText).toMatch(/MP/i)

    // Convert button should remain disabled
    await expect(page.locator('#convert-btn')).toBeDisabled()

    console.log(`[VALIDATION] Dimension-too-large error: "${errorText}"`)
  })

  // ── Performance guard: no main-thread blocking ───────────────────────────

  test('CSS animation is not frozen during conversion (no main-thread blocking)', async ({
    page,
  }) => {
    await page.locator('#file-input').setInputFiles(join(FIXTURES, 'test.png'))
    await expect(page.locator('#source-info')).not.toHaveClass(/hidden/, { timeout: 10_000 })

    await page.locator('#format-select').selectOption('jpeg')
    await page.locator('#convert-btn').click()

    // While the conversion is happening (Worker thread), the main thread should
    // remain responsive. We verify this by sampling RAF timestamps.
    const frameTimes = await page.evaluate(
      async (): Promise<number[]> => {
        return new Promise((resolve) => {
          const times: number[] = []
          let lastTime = performance.now()

          function tick(ts: number) {
            const delta = ts - lastTime
            lastTime = ts
            times.push(delta)
            if (times.length < 10) {
              requestAnimationFrame(tick)
            } else {
              resolve(times)
            }
          }
          requestAnimationFrame(tick)
        })
      },
    )

    // Verify that no frame took longer than 1000 ms (would indicate main-thread blocking)
    const maxFrameMs = Math.max(...frameTimes.slice(1)) // skip first delta which may be large
    expect(maxFrameMs).toBeLessThan(1000)

    // Wait for conversion to finish before leaving the test
    await expect(page.locator('#result-area')).not.toHaveClass(/hidden/, { timeout: 30_000 })

    console.log(`[PERF] Max frame delta during conversion: ${maxFrameMs.toFixed(1)} ms`)
  })

  // ── Blob URL cleanup ─────────────────────────────────────────────────────

  test('revokeObjectURL is called on result reset (no URL leak)', async ({ page }) => {
    await page.locator('#file-input').setInputFiles(join(FIXTURES, 'test.png'))
    await expect(page.locator('#source-info')).not.toHaveClass(/hidden/, { timeout: 10_000 })

    await page.locator('#format-select').selectOption('jpeg')
    await page.locator('#convert-btn').click()
    await expect(page.locator('#result-area')).not.toHaveClass(/hidden/, { timeout: 30_000 })

    // Capture the blob URL created after first conversion
    const firstBlobUrl = await page.locator('#download-link').getAttribute('href')
    expect(firstBlobUrl).toMatch(/^blob:/)

    // Intercept URL.revokeObjectURL calls
    const revokedUrls: string[] = []
    await page.evaluate(() => {
      const original = URL.revokeObjectURL.bind(URL)
      ;(window as unknown as Record<string, unknown>)['__revokedUrls'] = []
      URL.revokeObjectURL = (url: string) => {
        ;(window as unknown as { __revokedUrls: string[] }).__revokedUrls.push(url)
        original(url)
      }
    })

    // Trigger a second conversion — the first blob URL should be revoked on reset
    await page.locator('#file-input').setInputFiles(join(FIXTURES, 'test.jpg'))
    await expect(page.locator('#source-info')).not.toHaveClass(/hidden/, { timeout: 10_000 })

    const revoked = await page.evaluate(
      () => (window as unknown as { __revokedUrls: string[] }).__revokedUrls,
    )
    expect(revoked).toContain(firstBlobUrl)

    console.log(`[VALIDATION] revokeObjectURL called for: ${firstBlobUrl}`)
  })
})
