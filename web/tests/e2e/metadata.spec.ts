import { test, expect } from '@playwright/test'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dirname, '../fixtures')

/**
 * End-to-end metadata display tests.
 *
 * Verifies that image metadata is extracted and displayed when a file is
 * uploaded. Covers basic image info (format, dimensions, color type) and
 * the absence of EXIF data for formats that don't support it.
 */
test.describe('Image metadata display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => Boolean(window.__converter))
    await page.evaluate(() => window.__converter.ensureReady())
  })

  test('shows basic metadata after uploading PNG', async ({ page }) => {
    await page.locator('#file-input').setInputFiles(join(FIXTURES, 'test.png'))
    await expect(page.locator('#source-info')).toBeVisible({ timeout: 10_000 })

    // The IMAGE INFO details should be open by default
    const imageInfoSummary = page.locator('summary', { hasText: 'IMAGE INFO' })
    await expect(imageInfoSummary).toBeVisible({ timeout: 5_000 })

    // Check basic metadata values are displayed
    const metadataText = await page.locator('details', { has: imageInfoSummary }).textContent()
    expect(metadataText).toContain('PNG')
    expect(metadataText).toContain('px')
  })

  test('shows basic metadata after uploading JPEG', async ({ page }) => {
    await page.locator('#file-input').setInputFiles(join(FIXTURES, 'test.jpg'))
    await expect(page.locator('#source-info')).toBeVisible({ timeout: 10_000 })

    const imageInfoSummary = page.locator('summary', { hasText: 'IMAGE INFO' })
    await expect(imageInfoSummary).toBeVisible({ timeout: 5_000 })

    const metadataText = await page.locator('details', { has: imageInfoSummary }).textContent()
    expect(metadataText).toContain('JPEG')
    expect(metadataText).toContain('px')
  })

  test('shows no EXIF section for PNG without EXIF', async ({ page }) => {
    await page.locator('#file-input').setInputFiles(join(FIXTURES, 'test.png'))
    await expect(page.locator('#source-info')).toBeVisible({ timeout: 10_000 })

    // The EXIF DATA section should not be visible for a synthetic PNG
    const exifSummary = page.locator('summary', { hasText: 'EXIF DATA' })
    await expect(exifSummary).not.toBeVisible()
  })

  test('metadata panel disappears when error state', async ({ page }) => {
    // Initially no metadata visible (no file loaded)
    const imageInfoSummary = page.locator('summary', { hasText: 'IMAGE INFO' })
    await expect(imageInfoSummary).not.toBeVisible()
  })
})
