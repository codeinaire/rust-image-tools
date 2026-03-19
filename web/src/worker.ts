// TypeScript uses Window types by default; declare the Worker-specific postMessage overload.
declare function postMessage(message: unknown, transfer?: Transferable[]): void

import init, {
  convert_image,
  convert_image_with_transforms,
  decode_to_rgba,
  decode_to_rgba_with_transforms,
  detect_format,
  get_dimensions,
  get_image_metadata,
} from '../../crates/image-converter/pkg/image_converter.js'

import { MessageType, ValidFormat } from './types'
import type { ImageMetadata } from './types'
import type { BenchmarkImagesRequest, WorkerRequest, WorkerResponse } from './types'
import { getQualityForFormat } from './lib/quality'

/** Generation counter for benchmark cancellation. */
let benchmarkGeneration = 0

async function initialize(): Promise<void> {
  const start = performance.now()
  try {
    await init()
    const initMs = Math.round(performance.now() - start)
    const response: WorkerResponse = { type: MessageType.Init, success: true, initMs }
    postMessage(response)
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    const response: WorkerResponse = { type: MessageType.Init, success: false, error }
    postMessage(response)
  }
}

onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data

  switch (request.type) {
    case MessageType.DetectFormat:
      handleDetectFormat(request.id, request.data)
      break
    case MessageType.ConvertImage:
      void handleConvertImage(
        request.id,
        request.data,
        request.targetFormat,
        request.quality,
        request.transforms,
      )
      break
    case MessageType.GetDimensions:
      handleGetDimensions(request.id, request.data)
      break
    case MessageType.GetMetadata:
      handleGetMetadata(request.id, request.data)
      break
    case MessageType.BenchmarkImages:
      void handleBenchmarkImages(request)
      break
  }
}

function isValidFormat(value: string): value is ValidFormat {
  return (Object.values(ValidFormat) as string[]).includes(value)
}

function handleDetectFormat(id: number, data: Uint8Array): void {
  try {
    const format = detect_format(data)
    if (!isValidFormat(format)) {
      throw new Error(`Unrecognized image format: ${format}`)
    }
    const response: WorkerResponse = {
      type: MessageType.DetectFormat,
      id,
      success: true,
      format,
    }
    postMessage(response)
  } catch (e) {
    postError(id, e)
  }
}

function parseDimensions(value: unknown): { width: number; height: number } {
  if (typeof value === 'object' && value !== null && 'width' in value && 'height' in value) {
    const obj = value as Record<string, unknown>
    const w = obj['width']
    const h = obj['height']
    if (typeof w === 'number' && typeof h === 'number') {
      return { width: w, height: h }
    }
  }
  throw new Error('Unexpected shape returned from get_dimensions')
}

/** Encodes raw RGBA pixels to WebP via OffscreenCanvas. */
async function encodeRgbaToWebp(
  rgba: Uint8Array,
  width: number,
  height: number,
  quality: number,
): Promise<Uint8Array> {
  if (!('OffscreenCanvas' in globalThis)) {
    throw new Error('WebP output requires OffscreenCanvas, which is not supported in this browser.')
  }
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get 2D context from OffscreenCanvas.')
  }
  const clampedArray = new Uint8ClampedArray(rgba.buffer as ArrayBuffer)
  const imageData = new ImageData(clampedArray, width, height)
  ctx.putImageData(imageData, 0, 0)
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality })
  const arrayBuffer = await blob.arrayBuffer()
  return new Uint8Array(arrayBuffer)
}

/** Decodes an image to RGBA and encodes to WebP via Canvas. */
async function encodeWebpViaCanvas(data: Uint8Array, quality: number): Promise<Uint8Array> {
  const dims = parseDimensions(get_dimensions(data))
  const rgba = decode_to_rgba(data)
  return encodeRgbaToWebp(rgba, dims.width, dims.height, quality)
}

/** Decodes an image, applies transforms in Rust, then encodes to WebP via Canvas. */
async function encodeWebpWithTransforms(
  data: Uint8Array,
  quality: number,
  transforms: string[],
): Promise<Uint8Array> {
  const transformsCsv = transforms.join(',')
  const result = decode_to_rgba_with_transforms(data, transformsCsv) as {
    rgba: Uint8Array
    width: number
    height: number
  }
  return encodeRgbaToWebp(result.rgba, result.width, result.height, quality)
}

async function handleConvertImage(
  id: number,
  data: Uint8Array,
  targetFormat: ValidFormat,
  quality?: number,
  transforms?: string[],
): Promise<void> {
  try {
    const start = performance.now()
    let result: Uint8Array
    const hasTransforms = transforms !== undefined && transforms.length > 0
    if (targetFormat === ValidFormat.WebP && hasTransforms) {
      const canvasQuality = quality !== undefined ? quality / 100 : 0.85
      result = await encodeWebpWithTransforms(data, canvasQuality, transforms)
    } else if (targetFormat === ValidFormat.WebP) {
      const canvasQuality = quality !== undefined ? quality / 100 : 0.85
      result = await encodeWebpViaCanvas(data, canvasQuality)
    } else if (hasTransforms) {
      const transformsCsv = transforms.join(',')
      result = convert_image_with_transforms(data, targetFormat, quality, transformsCsv)
    } else {
      result = convert_image(data, targetFormat, quality)
    }
    const conversionMs = Math.round(performance.now() - start)
    const response: WorkerResponse = {
      type: MessageType.ConvertImage,
      id,
      success: true,
      data: result,
      conversionMs,
    }
    // Transfer the result buffer back to main thread (zero-copy, O(1))
    postMessage(response, [result.buffer])
  } catch (e) {
    postError(id, e)
  }
}

function handleGetDimensions(id: number, data: Uint8Array): void {
  try {
    const dims = parseDimensions(get_dimensions(data))
    const response: WorkerResponse = {
      type: MessageType.GetDimensions,
      id,
      success: true,
      width: dims.width,
      height: dims.height,
    }
    postMessage(response)
  } catch (e) {
    postError(id, e)
  }
}

/** Extract image metadata without fully decoding pixel data. */
function handleGetMetadata(id: number, data: Uint8Array): void {
  try {
    const metadata = get_image_metadata(data) as ImageMetadata
    const response: WorkerResponse = {
      type: MessageType.GetMetadata,
      id,
      success: true,
      metadata,
    }
    postMessage(response)
  } catch (e) {
    postError(id, e)
  }
}

async function handleBenchmarkImages(request: BenchmarkImagesRequest): Promise<void> {
  benchmarkGeneration++
  const myGeneration = benchmarkGeneration

  for (const format of request.formats) {
    if (myGeneration !== benchmarkGeneration) {
      return
    }

    try {
      const start = performance.now()
      let result: Uint8Array
      const quality = getQualityForFormat(format, request.quality)

      if (format === ValidFormat.WebP) {
        const canvasQuality = quality !== undefined ? quality / 100 : 0.85
        result = await encodeWebpViaCanvas(request.data, canvasQuality)
      } else {
        result = convert_image(request.data, format, quality)
      }

      const conversionMs = Math.round(performance.now() - start)
      const outputSize = result.byteLength

      if (myGeneration !== benchmarkGeneration) {
        return
      }

      const response: WorkerResponse = {
        type: MessageType.BenchmarkResult,
        id: request.id,
        format,
        success: true,
        outputSize,
        conversionMs,
        ...(request.withData ? { data: result } : {}),
      }
      postMessage(response, request.withData ? [result.buffer] : [])
    } catch (e) {
      if (myGeneration !== benchmarkGeneration) {
        return
      }

      const error = e instanceof Error ? e.message : String(e)
      const response: WorkerResponse = {
        type: MessageType.BenchmarkResult,
        id: request.id,
        format,
        success: false,
        error,
      }
      postMessage(response)
    }
  }

  if (myGeneration === benchmarkGeneration) {
    const response: WorkerResponse = {
      type: MessageType.BenchmarkComplete,
      id: request.id,
    }
    postMessage(response)
  }
}

function postError(id: number, e: unknown): void {
  const error = e instanceof Error ? e.message : String(e)
  const response: WorkerResponse = { type: MessageType.Error, id, error }
  postMessage(response)
}

// Initialize WASM immediately when the Worker is created
void initialize()
