import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dirname, '../fixtures')

/**
 * End-to-end test for clipboard paste support.
 *
 * Verifies that pasting an image from the clipboard into the converter
 * triggers format detection and displays source info. Only runs on Chromium
 * because clipboard API support varies across browser engines.
 */
test.describe('Clipboard paste', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => Boolean(window.__converter))
    await page.evaluate(() => window.__converter.ensureReady())
  })

  test('Ctrl+V paste triggers format detection and shows source info', async ({
    page,
  }) => {

    // Read a small PNG test image and write it to the clipboard
    const pngBytes = readFileSync(join(FIXTURES, 'test.png'))
    const pngBase64 = pngBytes.toString('base64')

    // Dispatch a synthetic paste event with the image file in clipboardData.
    // Keyboard shortcuts (Ctrl+V) don't populate DataTransfer in Playwright,
    // so we build the event manually.
    await page.evaluate(async (b64: string) => {
      const binary = atob(b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      const file = new File([bytes], 'pasted-image.png', { type: 'image/png' })

      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)

      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer,
      })
      document.dispatchEvent(pasteEvent)
    }, pngBase64)

    // Wait for source info to appear (format detected)
    await expect(page.locator('#source-info')).toBeVisible({ timeout: 15_000 })

    const detailsText = await page.locator('#source-details').textContent()
    expect(detailsText).toMatch(/PNG/i)

    console.log(`[E2E] Clipboard paste detected — source details: "${detailsText}"`)
  })
})
