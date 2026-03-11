import { test, expect, type Page } from '@playwright/test'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dirname, '../fixtures')
const HEIC_FIXTURE = join(FIXTURES, 'sample.heic')

const TOP_FORMATS = ['png', 'jpeg', 'webp', 'gif']

async function selectFormat(page: Page, fmt: string): Promise<void> {
  if (TOP_FORMATS.includes(fmt)) {
    await page.locator(`[data-format="${fmt}"]`).click()
  } else {
    await page.locator('#more-formats-btn').click()
    await page.locator(`[data-format="${fmt}"]`).waitFor({ state: 'visible' })
    await page.locator(`[data-format="${fmt}"]`).click()
    // Wait for the button label to update — confirms the prop has propagated
    // and the onConvert closure now captures the correct targetFormat.
    await expect(page.locator('#more-formats-btn')).toContainText(fmt.toUpperCase())
  }
}

/**
 * End-to-end conversion tests.
 *
 * Tests the full user-facing pipeline: file selection or drag-and-drop →
 * format detection → conversion → download. Covers the happy path for common
 * formats, HEIC input normalisation, UI metadata display, main-thread
 * responsiveness during conversion, and blob URL cleanup.
 */
test.describe('End-to-end conversion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => Boolean(window.__converter))
    await page.evaluate(() => window.__converter.ensureReady())
  })

  test('File select → convert → download: valid blob, correct MIME, non-zero size', async ({
    page,
  }) => {
    const pipelineStart = performance.now()

    // Select a JPEG file
    await page.locator('#file-input').setInputFiles(join(FIXTURES, 'test.jpg'))

    // Wait for source info to appear (format detected)
    await expect(page.locator('#source-info')).toBeVisible({ timeout: 10_000 })

    // Convert to PNG
    await selectFormat(page, 'png')
    const convertStart = Date.now()
    await page.locator('#convert-btn').click()

    // Wait for result area to appear
    await expect(page.locator('#result-area')).toBeVisible({ timeout: 30_000 })

    const totalMs = Date.now() - convertStart

    // Verify download link is present and has a valid href
    const downloadLink = page.locator('#download-link')
    const href = await downloadLink.getAttribute('href')
    expect(href).toBeTruthy()
    expect(href).toMatch(/^blob:/)

    // Verify the output size is non-zero
    const outputSize = await downloadLink.getAttribute('data-output-size')
    expect(Number(outputSize)).toBeGreaterThan(0)

    // Verify download filename has .png extension
    const downloadAttr = await downloadLink.getAttribute('download')
    expect(downloadAttr).toMatch(/\.png$/)

    // Verify the blob is a valid PNG by fetching it in-page
    expect(href).toBeDefined()
    const isValidPng = await page.evaluate(async (blobUrl: string) => {
      const res = await fetch(blobUrl)
      const buf = await res.arrayBuffer()
      const bytes = new Uint8Array(buf)
      // PNG magic: 89 50 4E 47 0D 0A 1A 0A
      return (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes.length > 0
      )
    }, href as string)
    expect(isValidPng).toBe(true)

    const pipelineTotalMs = Math.round(performance.now() - pipelineStart)
    console.log(
      `[PERF E2E] JPEG → PNG | convert: ${totalMs} ms | total_pipeline: ${pipelineTotalMs} ms | output: ${outputSize} bytes`,
    )
  })

  test('Format auto-detection: load JPEG, verify UI shows "JPEG" as source format', async ({
    page,
  }) => {
    await page.locator('#file-input').setInputFiles(join(FIXTURES, 'test.jpg'))

    await expect(page.locator('#source-info')).toBeVisible({ timeout: 10_000 })

    const detailsText = await page.locator('#source-details').textContent()
    expect(detailsText).toMatch(/JPEG/i)

    console.log(`[E2E] Source format detected: "${detailsText}"`)
  })

  test('Format auto-detection: load PNG, verify UI shows "PNG"', async ({ page }) => {
    await page.locator('#file-input').setInputFiles(join(FIXTURES, 'test.png'))

    await expect(page.locator('#source-info')).toBeVisible({ timeout: 10_000 })

    const detailsText = await page.locator('#source-details').textContent()
    expect(detailsText).toMatch(/PNG/i)
  })

  test('Before/after metadata: result details show sizes and conversion time', async ({ page }) => {
    await page.locator('#file-input').setInputFiles(join(FIXTURES, 'test.png'))

    await expect(page.locator('#source-info')).toBeVisible({ timeout: 10_000 })

    await selectFormat(page, 'jpeg')
    await page.locator('#convert-btn').click()

    await expect(page.locator('#result-area')).toBeVisible({ timeout: 30_000 })

    const detailsText = await page.locator('#result-details').textContent()
    expect(detailsText).toBeTruthy()
    // Should contain a size (e.g. "75 B → 1.2 KB") and a time (e.g. "12 ms" or "1.0 s")
    expect(detailsText).toMatch(/→/)
    expect(detailsText).toMatch(/(ms|s)/)

    console.log(`[E2E] Result details: "${detailsText}"`)
  })

  test('Error display: corrupted file triggers user-friendly error', async ({ page }) => {
    // Inject a fake corrupted file via drop event
    await page.evaluate(() => {
      const dropZone = document.getElementById('drop-zone')
      if (!dropZone) {
        throw new Error('drop-zone not found')
      }
      const corruptBytes = new Uint8Array([0xff, 0xfe, 0x00, 0x01, 0xde, 0xad, 0xbe, 0xef])
      const file = new File([corruptBytes], 'corrupt.png', { type: 'image/png' })
      const dt = new DataTransfer()
      dt.items.add(file)
      dropZone.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }))
    })

    // Wait for error display to appear
    await expect(page.locator('#error-display')).toBeVisible({ timeout: 15_000 })

    const errorText = await page.locator('#error-message').textContent()
    expect(errorText).toBeTruthy()
    expect(errorText?.length).toBeGreaterThan(0)

    console.log(`[E2E] Error shown for corrupted file: "${errorText}"`)
  })

  test('HEIC upload: file is decoded and source info appears', async ({ page }) => {
    await page.locator('#file-input').setInputFiles(HEIC_FIXTURE)

    // Normalisation can take a few seconds while heic-to WASM loads
    await expect(page.locator('#source-info')).toBeVisible({ timeout: 30_000 })

    // Normalised to PNG before reaching the Rust pipeline, so format shows as PNG
    const detailsText = await page.locator('#source-details').textContent()
    expect(detailsText).toMatch(/PNG/i)

    console.log(`[E2E] HEIC decoded — source details: "${detailsText}"`)
  })

  test('HEIC → JPEG: full pipeline produces valid JPEG blob', async ({ page }) => {
    await page.locator('#file-input').setInputFiles(HEIC_FIXTURE)
    await expect(page.locator('#source-info')).toBeVisible({ timeout: 30_000 })

    await page.locator('[data-format="jpeg"]').click()
    await page.locator('#convert-btn').click()

    await expect(page.locator('#result-area')).toBeVisible({ timeout: 30_000 })

    const href = await page.locator('#download-link').getAttribute('href')
    expect(href).toMatch(/^blob:/)

    const result = await page.evaluate(async (blobUrl: string) => {
      const res = await fetch(blobUrl)
      const buf = await res.arrayBuffer()
      const bytes = new Uint8Array(buf)
      return { size: bytes.byteLength, isJpeg: bytes[0] === 0xff && bytes[1] === 0xd8 }
    }, href as string)

    expect(result.size).toBeGreaterThan(0)
    expect(result.isJpeg).toBe(true)

    console.log(`[PERF E2E] HEIC → JPEG | output: ${result.size} bytes`)
  })

  test('Multiple format conversions produce correct MIME types', async ({ page }) => {
    const formats: { fmt: string; magic: number[] }[] = [
      { fmt: 'jpeg', magic: [0xff, 0xd8, 0xff] }, // JPEG SOI + APP marker
      { fmt: 'webp', magic: [0x52, 0x49, 0x46, 0x46] }, // RIFF
    ]

    for (const { fmt, magic } of formats) {
      // Reload fresh for each sub-test
      await page.goto('/')
      await page.waitForFunction(() => Boolean(window.__converter))
      await page.evaluate(() => window.__converter.ensureReady())

      await page.locator('#file-input').setInputFiles(join(FIXTURES, 'test.png'))
      await expect(page.locator('#source-info')).toBeVisible({ timeout: 10_000 })

      const pipelineStart = performance.now()
      await selectFormat(page, fmt)
      await page.locator('#convert-btn').click()
      await expect(page.locator('#result-area')).toBeVisible({ timeout: 30_000 })
      const totalMs = Math.round(performance.now() - pipelineStart)

      const href = await page.locator('#download-link').getAttribute('href')
      const outputSize = await page.locator('#download-link').getAttribute('data-output-size')

      const firstBytes = await page.evaluate(async (blobUrl: string) => {
        const res = await fetch(blobUrl)
        const buf = await res.arrayBuffer()
        return Array.from(new Uint8Array(buf.slice(0, 4)))
      }, href as string)

      for (let i = 0; i < magic.length; i++) {
        expect(firstBytes[i]).toBe(magic[i])
      }

      console.log(
        `[PERF E2E] PNG → ${fmt.toUpperCase()} | total: ${totalMs} ms | output: ${outputSize} bytes`,
      )
    }
  })
})
