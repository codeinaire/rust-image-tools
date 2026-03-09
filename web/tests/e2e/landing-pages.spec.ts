import { test, expect } from '@playwright/test'
import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

test.describe('SEO landing pages', () => {
  test('/png-to-jpeg returns 200 with correct title', async ({ page }) => {
    const response = await page.goto('/png-to-jpeg')
    expect(response?.status()).toBe(200)
    const title = await page.title()
    expect(title).toContain('Convert PNG to JPEG Online')
  })

  test('/png-to-jpeg has correct canonical link', async ({ page }) => {
    await page.goto('/png-to-jpeg')
    const canonical = await page.getAttribute('link[rel="canonical"]', 'href')
    expect(canonical).toBe('https://imagetoolz.app/png-to-jpeg')
  })

  test('/heic-to-jpeg returns 200 with correct title', async ({ page }) => {
    const response = await page.goto('/heic-to-jpeg')
    expect(response?.status()).toBe(200)
    const title = await page.title()
    expect(title).toContain('Convert HEIC to JPEG')
  })

  test('/png-to-png returns 404', async ({ page }) => {
    const response = await page.goto('/png-to-png')
    expect(response?.status()).toBe(404)
  })

  test('/tga-to-png returns 404 (TGA is output-only)', async ({ page }) => {
    const response = await page.goto('/tga-to-png')
    expect(response?.status()).toBe(404)
  })

  test('/png-to-jpeg has converter widget rendered', async ({ page }) => {
    await page.goto('/png-to-jpeg')
    // The converter Preact island should hydrate and render the drop zone
    const dropZone = page.locator('#drop-zone')
    await expect(dropZone).toBeVisible({ timeout: 10000 })
    // The format selector buttons only appear after a file is loaded,
    // but we can verify the converter component is present and the
    // initial target format will be JPEG based on the initialTo prop.
  })

  test('sitemap contains format pair URLs after build', async () => {
    const distDir = join(__dirname, '../../dist')
    const sitemapPath = join(distDir, 'sitemap-0.xml')

    // This test requires a prior build. Skip gracefully if dist does not exist.
    if (!existsSync(sitemapPath)) {
      test.skip()
      return
    }

    const content = readFileSync(sitemapPath, 'utf-8')
    expect(content).toContain('png-to-jpeg')
  })
})
