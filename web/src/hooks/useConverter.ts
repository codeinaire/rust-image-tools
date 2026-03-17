import { useState, useRef, useEffect, useCallback } from 'preact/hooks'
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
import { normalizeHeic } from '../lib/heic'
import { getQualityForFormat } from '../lib/quality'

export { FORMATS_WITH_QUALITY, getQualityForFormat } from '../lib/quality'

export type InputMethod = 'file_picker' | 'drag_drop' | 'clipboard_paste'

/** Transform name strings matching the Rust Transform enum variants. */
export type TransformName =
  | 'flip_horizontal'
  | 'flip_vertical'
  | 'rotate_90'
  | 'rotate_180'
  | 'rotate_270'
  | 'grayscale'
  | 'invert'

/** Debounce delay (ms) before re-conversion when transforms change. */
const TRANSFORM_DEBOUNCE_MS = 300

/**
 * Normalizes accumulated rotation clicks into a single rotation transform.
 * 4 quarter-turns = full rotation = no-op.
 */
function normalizeRotation(quarterTurns: number): TransformName | null {
  const normalized = ((quarterTurns % 4) + 4) % 4
  if (normalized === 1) {
    return 'rotate_90'
  }
  if (normalized === 2) {
    return 'rotate_180'
  }
  if (normalized === 3) {
    return 'rotate_270'
  }
  return null
}

/**
 * Computes the net rotation quarter-turns from a transforms list.
 * rotate_90 = +1, rotate_180 = +2, rotate_270 = +3.
 */
function getRotationQuarterTurns(transforms: TransformName[]): number {
  let turns = 0
  for (const t of transforms) {
    if (t === 'rotate_90') {
      turns += 1
    } else if (t === 'rotate_180') {
      turns += 2
    } else if (t === 'rotate_270') {
      turns += 3
    }
  }
  return turns
}

/**
 * Rebuilds the transforms list with a new net rotation, preserving non-rotation transforms.
 */
function rebuildWithRotation(
  transforms: TransformName[],
  newRotation: TransformName | null,
): TransformName[] {
  const nonRotation = transforms.filter(
    (t) => t !== 'rotate_90' && t !== 'rotate_180' && t !== 'rotate_270',
  )
  if (newRotation === null) {
    return nonRotation
  }
  return [...nonRotation, newRotation]
}

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

interface TimingRate {
  base: number
  perMp: number
}
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
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export interface FileInfo {
  file: File
  bytes: Uint8Array
  sourceFormat: ValidFormat
  megapixels: number
  width: number
  height: number
}

export interface ConversionResult {
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

export interface ConverterState {
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
  handleFile: (file: File, inputMethod: InputMethod) => Promise<void>
  handleConvert: (targetFormat: ValidFormat) => Promise<void>
  quality: number
  setQuality: (quality: number) => void
  transforms: TransformName[]
  rotateCW: (targetFormat: ValidFormat) => void
  rotateCCW: (targetFormat: ValidFormat) => void
  toggleTransform: (targetFormat: ValidFormat, name: TransformName) => void
  undoTransform: (targetFormat: ValidFormat) => void
  canUndoTransform: boolean
} {
  const converter = useImageConverter()
  const blobUrlRef = useRef<string | null>(null)
  const progressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const convertGenerationRef = useRef<number>(0)
  const transformDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transformsRef = useRef<TransformName[]>([])
  const transformHistoryRef = useRef<TransformName[][]>([])

  const [quality, setQuality] = useState<number>(80)
  const [transforms, setTransformsState] = useState<TransformName[]>([])

  /** Updates transforms state and keeps the ref in sync for use in closures. */
  function setTransforms(newTransforms: TransformName[]): void {
    transformsRef.current = newTransforms
    setTransformsState(newTransforms)
  }

  /** Pushes the current transforms onto the history stack before a change. */
  function pushTransformHistory(): void {
    const MAX_TRANSFORM_HISTORY = 50
    const history = [...transformHistoryRef.current, [...transformsRef.current]]
    transformHistoryRef.current = history.slice(-MAX_TRANSFORM_HISTORY)
  }

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
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
      }
      if (progressTimeoutRef.current !== null) {
        clearTimeout(progressTimeoutRef.current)
      }
      if (transformDebounceRef.current !== null) {
        clearTimeout(transformDebounceRef.current)
      }
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

  function clearTransformDebounce(): void {
    if (transformDebounceRef.current !== null) {
      clearTimeout(transformDebounceRef.current)
      transformDebounceRef.current = null
    }
  }

  async function handleFile(file: File, inputMethod: InputMethod): Promise<void> {
    revokeBlobUrl()
    clearProgressTimeout()
    clearTransformDebounce()
    setTransforms([])
    transformHistoryRef.current = []

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

    const normalizedFile = await normalizeHeic(file)
    const buffer = await normalizedFile.arrayBuffer()
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
          sourceFormat: format,
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
    const { fileInfo } = state
    if (!fileInfo) {
      return
    }

    convertGenerationRef.current++
    const myGeneration = convertGenerationRef.current

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

    const qualityForFormat = getQualityForFormat(targetFormat, quality)

    const currentTransforms = transformsRef.current
    const hasTransforms = currentTransforms.length > 0
    trackConversionStarted({
      source_format: fileInfo.sourceFormat,
      target_format: targetFormat,
      file_size_bytes: fileInfo.file.size,
      megapixels: fileInfo.megapixels,
      ...(qualityForFormat !== undefined ? { quality: qualityForFormat } : {}),
      ...(hasTransforms ? { transforms: currentTransforms } : {}),
    })

    const startTime = performance.now()

    try {
      const resultBytes = await converter.convertImage(
        fileInfo.bytes,
        targetFormat,
        qualityForFormat,
        hasTransforms ? currentTransforms : undefined,
      )
      if (myGeneration !== convertGenerationRef.current) {
        return
      }

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
        ...(qualityForFormat !== undefined ? { quality: qualityForFormat } : {}),
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
      if (myGeneration !== convertGenerationRef.current) {
        return
      }
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

  /** Stable ref for handleConvert so useCallback chains don't break memoization. */
  const handleConvertRef = useRef(handleConvert)
  handleConvertRef.current = handleConvert

  /** Schedules a debounced re-conversion when transforms change. */
  const scheduleTransformConvert = useCallback(
    (targetFormat: ValidFormat, newTransforms: TransformName[]) => {
      clearTransformDebounce()
      pushTransformHistory()
      setTransforms(newTransforms)
      // Only auto-convert if we have a file and a previous conversion result
      if (state.fileInfo && state.status !== 'reading') {
        transformDebounceRef.current = setTimeout(() => {
          transformDebounceRef.current = null
          void handleConvertRef.current(targetFormat)
        }, TRANSFORM_DEBOUNCE_MS)
      }
    },
    [state.fileInfo, state.status],
  )

  /** Adds one clockwise quarter-turn, normalizing the net rotation. */
  const rotateCW = useCallback(
    (targetFormat: ValidFormat) => {
      const currentTurns = getRotationQuarterTurns(transforms)
      const newRotation = normalizeRotation(currentTurns + 1)
      const newTransforms = rebuildWithRotation(transforms, newRotation)
      scheduleTransformConvert(targetFormat, newTransforms)
    },
    [transforms, scheduleTransformConvert],
  )

  /** Adds one counter-clockwise quarter-turn, normalizing the net rotation. */
  const rotateCCW = useCallback(
    (targetFormat: ValidFormat) => {
      const currentTurns = getRotationQuarterTurns(transforms)
      const newRotation = normalizeRotation(currentTurns - 1)
      const newTransforms = rebuildWithRotation(transforms, newRotation)
      scheduleTransformConvert(targetFormat, newTransforms)
    },
    [transforms, scheduleTransformConvert],
  )

  /** Toggles a transform on/off in the transforms list. */
  const toggleTransform = useCallback(
    (targetFormat: ValidFormat, name: TransformName) => {
      const newTransforms = transforms.includes(name)
        ? transforms.filter((t) => t !== name)
        : [...transforms, name]
      scheduleTransformConvert(targetFormat, newTransforms)
    },
    [transforms, scheduleTransformConvert],
  )

  /** Reverts to the previous transform state. */
  const undoTransform = useCallback(
    (targetFormat: ValidFormat) => {
      const history = transformHistoryRef.current
      if (history.length === 0) {
        return
      }
      const previous = history[history.length - 1] as TransformName[]
      transformHistoryRef.current = history.slice(0, -1)
      clearTransformDebounce()
      setTransforms(previous)
      if (state.fileInfo && state.status !== 'reading') {
        transformDebounceRef.current = setTimeout(() => {
          transformDebounceRef.current = null
          void handleConvertRef.current(targetFormat)
        }, TRANSFORM_DEBOUNCE_MS)
      }
    },
    [state.fileInfo, state.status],
  )

  const canUndoTransform = transformHistoryRef.current.length > 0

  return {
    state,
    converter,
    handleFile,
    handleConvert,
    quality,
    setQuality,
    transforms,
    rotateCW,
    rotateCCW,
    toggleTransform,
    undoTransform,
    canUndoTransform,
  }
}
