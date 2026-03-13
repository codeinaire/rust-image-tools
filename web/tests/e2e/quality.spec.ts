import { test, expect } from '@playwright/test'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dirname, '../fixtures')

/**
 * Quality slider E2E tests.
 *
 * Verifies that the quality slider appears for supported formats,
 * persists its value across format switches, and hides for unsupported formats.
 */
test.describe('Quality slider', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => Boolean(window.__converter))
    await page.evaluate(() => window.__converter.ensureReady())
  })

  test('Slider visible for JPEG with default value 80, convert succeeds at quality 50', async ({
    page,
  }) => {
    // Upload an image
    await page.locator('#file-input').setInputFiles(join(FIXTURES, 'test.png'))
    await expect(page.locator('#source-info')).toBeVisible({ timeout: 10_000 })

    // Select JPEG format
    await page.locator('[data-format="jpeg"]').click()

    // Quality slider should be visible with default value 80
    const slider = page.locator('#quality-slider')
    await expect(slider).toBeVisible()
    await expect(slider).toHaveValue('80')

    // Change quality to 50
    await slider.fill('50')
    await expect(slider).toHaveValue('50')

    // Convert should succeed
    await page.locator('#convert-btn').click()
    await expect(page.locator('#result-area')).toBeVisible({ timeout: 30_000 })
  })

  test('Slider value persists across format switches', async ({ page }) => {
    await page.locator('#file-input').setInputFiles(join(FIXTURES, 'test.png'))
    await expect(page.locator('#source-info')).toBeVisible({ timeout: 10_000 })

    // Select JPEG and change quality to 50
    await page.locator('[data-format="jpeg"]').click()
    const slider = page.locator('#quality-slider')
    await expect(slider).toBeVisible()
    await slider.fill('50')
    await expect(slider).toHaveValue('50')

    // Switch to PNG -- slider should still be visible with same value
    await page.locator('[data-format="png"]').click()
    await expect(slider).toBeVisible()
    await expect(slider).toHaveValue('50')

    // Switch to BMP -- slider should be hidden
    // Use the selectFormat helper pattern: click more-formats button, then click BMP via JS dispatch
    // since the portal-positioned dropdown can be outside viewport in headless mode
    await page.locator('#more-formats-btn').click()
    await page.locator('[data-format="bmp"]').waitFor({ state: 'visible' })
    await page.evaluate(() => {
      const bmpItem = document.querySelector('[data-format="bmp"]')
      if (bmpItem instanceof HTMLElement) {
        bmpItem.click()
      }
    })
    await expect(page.locator('#more-formats-btn')).toContainText('BMP')
    await expect(slider).not.toBeVisible()

    // Switch back to JPEG -- slider should reappear with persisted value 50
    await page.locator('button[data-format="jpeg"]').click()
    await expect(slider).toBeVisible()
    await expect(slider).toHaveValue('50')
  })
})
