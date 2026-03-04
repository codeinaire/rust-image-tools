import { useState, useRef, useEffect } from 'preact/hooks'
import { useImageConverter } from './useImageConverter'
import {
  trackImageSelected,
  trackConversionStarted,
  trackConversionCompleted,
  trackConversionFailed,
  trackValidationRejected,
} from '../analytics'
import type { ImageConverter } from '../lib/image-converter'
import { ValidFormat } from '../types'

const MAX_FILE_SIZE = 200 * 1024 * 1024 // 200 MB
const MAX_MEGAPIXELS = 100

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
  tiff: 'image/tiff',
  ico: 'image/x-icon',
  tga: 'image/x-tga',
  qoi: 'image/qoi',
}

type TimingRate = { base: number; perMp: number }
const TIMING_RATES: Record<string, TimingRate> = {
  'jpeg->png': { base: 20, perMp: 40 },
  'png->jpeg': { base: 20, perMp: 25 },
  'webp->png': { base: 20, perMp: 35 },
  'bmp->jpeg': { base: 20, perMp: 25 },
  'png->webp': { base: 25, perMp: 35 },
  'jpeg->webp': { base: 25, perMp: 35 },
  'gif->webp': { base: 25, perMp: 30 },
  'bmp->webp': { base: 25, perMp: 30 },
  'webp->webp': { base: 25, perMp: 35 },
}
const TIMING_FALLBACK: TimingRate = { base: 30, perMp: 50 }

function estimateConversionMs(
  sourceFormat: ValidFormat,
  targetFormat: ValidFormat,
  megapixels: number,
): number {
  const key = `${sourceFormat}->${targetFormat}`
  const rate = TIMING_RATES[key] ?? TIMING_FALLBACK
  return rate.base + megapixels * rate.perMp
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export type FileInfo = {
  file: File
  bytes: Uint8Array
  sourceFormat: ValidFormat
  megapixels: number
  width: number
  height: number
}

export type ConversionResult = {
  bytes: Uint8Array
  blobUrl: string
  inputSize: number
  outputSize: number
  changePercent: number
  elapsedMs: number
  filename: string
  extension: string
  targetFormat: ValidFormat
}

export type ConverterStatus = 'idle' | 'reading' | 'converting' | 'done' | 'error'

export type ConverterState = {
  status: ConverterStatus
  fileInfo: FileInfo | null
  result: ConversionResult | null
  error: string | null
  estimatedMs: number
  showProgress: boolean
}

export function useConverter(): {
  state: ConverterState
  converter: ImageConverter
  handleFile: (file: File, inputMethod: 'file_picker' | 'drag_drop') => Promise<void>
  handleConvert: (targetFormat: ValidFormat) => Promise<void>
} {
  const converter = useImageConverter()
  const blobUrlRef = useRef<string | null>(null)
  const progressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [state, setState] = useState<ConverterState>({
    status: 'idle',
    fileInfo: null,
    result: null,
    error: null,
    estimatedMs: 0,
    showProgress: false,
  })

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      if (progressTimeoutRef.current !== null) clearTimeout(progressTimeoutRef.current)
    }
  }, [])

  function revokeBlobUrl(): void {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
  }

  function clearProgressTimeout(): void {
    if (progressTimeoutRef.current !== null) {
      clearTimeout(progressTimeoutRef.current)
      progressTimeoutRef.current = null
    }
  }

  async function handleFile(file: File, inputMethod: 'file_picker' | 'drag_drop'): Promise<void> {
    revokeBlobUrl()
    clearProgressTimeout()

    if (file.size > MAX_FILE_SIZE) {
      trackValidationRejected({
        reason: 'file_too_large',
        file_size_bytes: file.size,
        megapixels: null,
      })
      setState((s) => ({
        ...s,
        status: 'error',
        error: `File too large (${formatFileSize(file.size)}). Maximum allowed: ${formatFileSize(MAX_FILE_SIZE)}.`,
        fileInfo: null,
        result: null,
        showProgress: false,
      }))
      return
    }

    setState((s) => ({
      ...s,
      status: 'reading',
      error: null,
      fileInfo: null,
      result: null,
      showProgress: false,
    }))

    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    try {
      const [format, dimensions] = await Promise.all([
        converter.detectFormat(bytes),
        converter.getDimensions(bytes),
      ])

      const megapixels = (dimensions.width * dimensions.height) / 1_000_000

      if (megapixels > MAX_MEGAPIXELS) {
        trackValidationRejected({
          reason: 'dimensions_too_large',
          file_size_bytes: file.size,
          megapixels,
        })
        setState((s) => ({
          ...s,
          status: 'error',
          error: `Image too large (${dimensions.width}×${dimensions.height}, ${megapixels.toFixed(1)} MP). Maximum allowed: ${MAX_MEGAPIXELS} MP.`,
          fileInfo: null,
        }))
        return
      }

      trackImageSelected({
        source_format: format,
        file_size_bytes: file.size,
        width: dimensions.width,
        height: dimensions.height,
        megapixels,
        input_method: inputMethod,
      })

      setState((s) => ({
        ...s,
        status: 'idle',
        error: null,
        fileInfo: {
          file,
          bytes,
          sourceFormat: format as ValidFormat,
          megapixels,
          width: dimensions.width,
          height: dimensions.height,
        },
      }))
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setState((s) => ({
        ...s,
        status: 'error',
        error: `Could not read image: ${message}`,
        fileInfo: null,
      }))
    }
  }

  async function handleConvert(targetFormat: ValidFormat): Promise<void> {
    const { fileInfo, status } = state
    if (!fileInfo || status === 'converting') return

    revokeBlobUrl()
    clearProgressTimeout()

    const estimatedMs = estimateConversionMs(
      fileInfo.sourceFormat,
      targetFormat,
      fileInfo.megapixels,
    )
    setState((s) => ({
      ...s,
      status: 'converting',
      error: null,
      result: null,
      estimatedMs,
      showProgress: true,
    }))

    trackConversionStarted({
      source_format: fileInfo.sourceFormat,
      target_format: targetFormat,
      file_size_bytes: fileInfo.file.size,
      megapixels: fileInfo.megapixels,
    })

    const startTime = performance.now()

    try {
      const resultBytes = await converter.convertImage(fileInfo.bytes, targetFormat)
      const elapsedMs = Math.round(performance.now() - startTime)

      const mimeType = MIME_TYPES[targetFormat] ?? 'application/octet-stream'
      const blob = new Blob([resultBytes.buffer as ArrayBuffer], { type: mimeType })
      const blobUrl = URL.createObjectURL(blob)
      blobUrlRef.current = blobUrl

      const changePercent =
        ((resultBytes.byteLength - fileInfo.file.size) / fileInfo.file.size) * 100
      const baseName = fileInfo.file.name.replace(/\.[^.]+$/, '')
      const extension = targetFormat === ValidFormat.Jpeg ? 'jpg' : targetFormat

      trackConversionCompleted({
        source_format: fileInfo.sourceFormat,
        target_format: targetFormat,
        input_size_bytes: fileInfo.file.size,
        output_size_bytes: resultBytes.byteLength,
        size_change_pct: changePercent,
        width: fileInfo.width,
        height: fileInfo.height,
        megapixels: fileInfo.megapixels,
        conversion_ms: elapsedMs,
        pipeline_total_ms: elapsedMs,
      })

      setState((s) => ({
        ...s,
        status: 'done',
        result: {
          bytes: resultBytes,
          blobUrl,
          inputSize: fileInfo.file.size,
          outputSize: resultBytes.byteLength,
          changePercent,
          elapsedMs,
          filename: `${baseName}.${extension}`,
          extension,
          targetFormat,
        },
      }))

      // Hide progress bar 500ms after the 200ms snap animation completes
      progressTimeoutRef.current = setTimeout(() => {
        progressTimeoutRef.current = null
        setState((s) => ({ ...s, showProgress: false }))
      }, 700)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      const errorType = message.includes('decode')
        ? 'decode_error'
        : message.includes('encode')
          ? 'encode_error'
          : message.includes('unsupported') || message.includes('Unsupported')
            ? 'unsupported_format'
            : 'unknown'

      trackConversionFailed({
        source_format: fileInfo.sourceFormat,
        target_format: targetFormat,
        file_size_bytes: fileInfo.file.size,
        error_type: errorType,
        error_message: message,
      })

      setState((s) => ({
        ...s,
        status: 'error',
        error: `Conversion failed: ${message}`,
        showProgress: false,
      }))
    }
  }

  return { state, converter, handleFile, handleConvert }
}
