import { converter } from './main'

const MAX_FILE_SIZE = 200 * 1024 * 1024 // 200 MB
const MAX_MEGAPIXELS = 100

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
}

// DOM elements — cached on init
let dropZone: HTMLDivElement
let fileInput: HTMLInputElement
let errorDisplay: HTMLDivElement
let errorMessage: HTMLParagraphElement
let sourceInfo: HTMLDivElement
let sourceFilename: HTMLSpanElement
let sourceDetails: HTMLSpanElement
let formatSelect: HTMLSelectElement
let convertBtn: HTMLButtonElement
let progressContainer: HTMLDivElement
let progressBar: HTMLDivElement
let progressText: HTMLParagraphElement
let resultArea: HTMLDivElement
let previewImage: HTMLImageElement
let resultDetails: HTMLDivElement
let downloadLink: HTMLAnchorElement
let gifWarning: HTMLDivElement

// State
let currentFile: File | null = null
let currentBytes: Uint8Array | null = null
let currentSourceFormat: string | null = null
let currentBlobUrl: string | null = null
let currentMegapixels = 0

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const GIF_SLOW_THRESHOLD_MP = 2

// Format-pair timing rates for estimated progress bar.
// estimated_ms = base_ms + (megapixels * ms_per_mp)
type TimingRate = { base: number; perMp: number }
const TIMING_RATES: Record<string, TimingRate> = {
  'jpeg->png': { base: 20, perMp: 40 },
  'png->jpeg': { base: 20, perMp: 25 },
  'webp->png': { base: 20, perMp: 35 },
  'bmp->jpeg': { base: 20, perMp: 25 },
}
const TIMING_FALLBACK: TimingRate = { base: 30, perMp: 50 }

function estimateConversionMs(sourceFormat: string, targetFormat: string, megapixels: number): number {
  const key = `${sourceFormat}->${targetFormat}`
  const rate = TIMING_RATES[key] ?? TIMING_FALLBACK
  return rate.base + megapixels * rate.perMp
}

function updateGifWarning(): void {
  const showWarning =
    formatSelect.value === 'gif' && currentBytes !== null && currentMegapixels >= GIF_SLOW_THRESHOLD_MP
  gifWarning.classList.toggle('hidden', !showWarning)
}

function showError(message: string): void {
  errorMessage.textContent = message
  errorDisplay.classList.remove('hidden')
}

function hideError(): void {
  errorDisplay.classList.add('hidden')
}

function revokeBlobUrl(): void {
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl)
    currentBlobUrl = null
  }
}

function resetResult(): void {
  revokeBlobUrl()
  resultArea.classList.add('hidden')
  previewImage.removeAttribute('src')
  resultDetails.textContent = ''
  downloadLink.removeAttribute('href')
  progressContainer.classList.add('hidden')
  progressBar.style.transition = 'width 0ms ease-out'
  progressBar.style.width = '0%'
}

async function handleFile(file: File): Promise<void> {
  hideError()
  resetResult()

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    showError(`File too large (${formatFileSize(file.size)}). Maximum allowed: ${formatFileSize(MAX_FILE_SIZE)}.`)
    return
  }

  currentFile = file

  // Read file bytes
  const buffer = await file.arrayBuffer()
  currentBytes = new Uint8Array(buffer)

  // Detect format and dimensions in parallel
  try {
    const [format, dimensions] = await Promise.all([
      converter.detectFormat(currentBytes),
      converter.getDimensions(currentBytes),
    ])

    currentSourceFormat = format

    // Validate dimensions
    const megapixels = (dimensions.width * dimensions.height) / 1_000_000
    currentMegapixels = megapixels
    if (megapixels > MAX_MEGAPIXELS) {
      showError(
        `Image too large (${dimensions.width}x${dimensions.height}, ${megapixels.toFixed(1)} MP). Maximum allowed: ${MAX_MEGAPIXELS} MP.`
      )
      currentFile = null
      currentBytes = null
      currentSourceFormat = null
      return
    }

    // Display source info
    sourceFilename.textContent = file.name
    sourceDetails.textContent = `${format.toUpperCase()} \u2014 ${dimensions.width}\u00d7${dimensions.height} \u2014 ${formatFileSize(file.size)}`
    sourceInfo.classList.remove('hidden')

    // Enable convert button
    convertBtn.disabled = false
    updateGifWarning()
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    showError(`Could not read image: ${message}`)
    currentFile = null
    currentBytes = null
    currentSourceFormat = null
  }
}

async function handleConvert(): Promise<void> {
  if (!currentBytes || !currentFile) return

  const targetFormat = formatSelect.value
  hideError()
  resetResult()

  // Disable button, show progress
  convertBtn.disabled = true
  progressContainer.classList.remove('hidden')
  progressBar.style.transition = 'width 0ms ease-out'
  progressBar.style.width = '0%'
  progressText.textContent = 'Converting...'

  // Animate progress to 90% over estimated conversion time
  const estimatedMs = estimateConversionMs(
    currentSourceFormat ?? '',
    targetFormat,
    currentMegapixels,
  )
  const animationMs = Math.round(estimatedMs * 0.9)
  requestAnimationFrame(() => {
    progressBar.style.transition = `width ${animationMs}ms ease-out`
    progressBar.style.width = '90%'
  })

  const startTime = performance.now()

  try {
    const result = await converter.convertImage(currentBytes, targetFormat)
    const elapsedMs = Math.round(performance.now() - startTime)

    // Snap progress to 100% with a fast transition
    progressBar.style.transition = 'width 200ms ease-out'
    progressBar.style.width = '100%'
    progressText.textContent = 'Done!'

    // Create blob and URL
    const mimeType = MIME_TYPES[targetFormat] ?? 'application/octet-stream'
    const blob = new Blob([result], { type: mimeType })
    currentBlobUrl = URL.createObjectURL(blob)

    // Show preview
    previewImage.src = currentBlobUrl
    previewImage.alt = `Converted image (${targetFormat.toUpperCase()})`

    // Set download link
    const baseName = currentFile.name.replace(/\.[^.]+$/, '')
    const extension = targetFormat === 'jpeg' ? 'jpg' : targetFormat
    downloadLink.href = currentBlobUrl
    downloadLink.download = `${baseName}.${extension}`

    // Show result details
    const inputSize = currentFile.size
    const outputSize = result.byteLength
    const changePercent = ((outputSize - inputSize) / inputSize) * 100
    const sign = changePercent >= 0 ? '+' : ''
    const timeStr = elapsedMs < 1000 ? `${elapsedMs} ms` : `${(elapsedMs / 1000).toFixed(1)} s`
    resultDetails.textContent = `${formatFileSize(inputSize)} \u2192 ${formatFileSize(outputSize)} (${sign}${changePercent.toFixed(0)}%) \u2014 ${timeStr}`

    resultArea.classList.remove('hidden')

    // Hide progress after brief pause
    setTimeout(() => {
      progressContainer.classList.add('hidden')
    }, 500)
  } catch (e) {
    progressBar.style.transition = 'width 0ms ease-out'
    progressBar.style.width = '0%'
    progressContainer.classList.add('hidden')
    const message = e instanceof Error ? e.message : String(e)
    showError(`Conversion failed: ${message}`)
  } finally {
    convertBtn.disabled = false
  }
}

/// Initialize the UI — call once after DOM is ready.
export function initUI(): void {
  // Cache DOM elements
  dropZone = document.getElementById('drop-zone') as HTMLDivElement
  fileInput = document.getElementById('file-input') as HTMLInputElement
  errorDisplay = document.getElementById('error-display') as HTMLDivElement
  errorMessage = document.getElementById('error-message') as HTMLParagraphElement
  sourceInfo = document.getElementById('source-info') as HTMLDivElement
  sourceFilename = document.getElementById('source-filename') as HTMLSpanElement
  sourceDetails = document.getElementById('source-details') as HTMLSpanElement
  formatSelect = document.getElementById('format-select') as HTMLSelectElement
  convertBtn = document.getElementById('convert-btn') as HTMLButtonElement
  progressContainer = document.getElementById('progress-container') as HTMLDivElement
  progressBar = document.getElementById('progress-bar') as HTMLDivElement
  progressText = document.getElementById('progress-text') as HTMLParagraphElement
  resultArea = document.getElementById('result-area') as HTMLDivElement
  previewImage = document.getElementById('preview-image') as HTMLImageElement
  resultDetails = document.getElementById('result-details') as HTMLDivElement
  downloadLink = document.getElementById('download-link') as HTMLAnchorElement
  gifWarning = document.getElementById('gif-warning') as HTMLDivElement

  // Click-to-browse: clicking the drop zone triggers the hidden file input
  dropZone.addEventListener('click', () => fileInput.click())

  // File input change
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    if (file) handleFile(file)
  })

  // Drag-and-drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault()
    dropZone.classList.add('border-blue-400', 'bg-blue-50')
  })

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-blue-400', 'bg-blue-50')
  })

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault()
    dropZone.classList.remove('border-blue-400', 'bg-blue-50')
    const file = e.dataTransfer?.files[0]
    if (file) handleFile(file)
  })

  // Format selector change — update GIF warning
  formatSelect.addEventListener('change', () => updateGifWarning())

  // Convert button
  convertBtn.addEventListener('click', () => handleConvert())
}
