import type { MessageType, ValidFormat } from './enums'

// Request types (main thread → worker)

export interface DetectFormatRequest {
  type: MessageType.DetectFormat
  id: number
  data: Uint8Array
}

export interface ConvertImageRequest {
  type: MessageType.ConvertImage
  id: number
  data: Uint8Array
  targetFormat: ValidFormat
  quality?: number
  transforms?: string[]
}

export interface GetDimensionsRequest {
  type: MessageType.GetDimensions
  id: number
  data: Uint8Array
}

export interface BenchmarkImagesRequest {
  type: MessageType.BenchmarkImages
  id: number
  data: Uint8Array
  formats: ValidFormat[]
  quality: number
  withData: boolean
}

// Response types (worker → main thread)

export interface InitSuccessResponse {
  type: MessageType.Init
  success: true
  initMs: number
}

export interface InitErrorResponse {
  type: MessageType.Init
  success: false
  error: string
}

export interface DetectFormatSuccessResponse {
  type: MessageType.DetectFormat
  id: number
  success: true
  format: ValidFormat
}

export interface ConvertImageSuccessResponse {
  type: MessageType.ConvertImage
  id: number
  success: true
  data: Uint8Array
  conversionMs: number
}

export interface GetDimensionsSuccessResponse {
  type: MessageType.GetDimensions
  id: number
  success: true
  width: number
  height: number
}

export interface ErrorResponse {
  type: MessageType.Error
  id: number
  error: string
}

export interface BenchmarkResultSuccess {
  type: MessageType.BenchmarkResult
  id: number
  format: ValidFormat
  success: true
  data?: Uint8Array
  outputSize: number
  conversionMs: number
}

export interface BenchmarkResultError {
  type: MessageType.BenchmarkResult
  id: number
  format: ValidFormat
  success: false
  error: string
}

export type BenchmarkResultResponse = BenchmarkResultSuccess | BenchmarkResultError

export interface BenchmarkCompleteResponse {
  type: MessageType.BenchmarkComplete
  id: number
}

export interface ImageDimensions {
  width: number
  height: number
}

// Metadata types

/** Metadata extracted from an image by the WASM module. */
export interface ImageMetadata {
  width: number
  height: number
  format: string
  color_type: string
  bits_per_pixel: number
  has_alpha: boolean
  has_icc_profile: boolean
  exif: ExifData
  png_text_chunks: TextChunk[]
}

/** Parsed EXIF data with curated fields and optional full field list. */
export interface ExifData {
  camera_make: string | null
  camera_model: string | null
  date_time: string | null
  exposure_time: string | null
  f_number: string | null
  iso: string | null
  focal_length: string | null
  orientation: string | null
  software: string | null
  gps_latitude: number | null
  gps_longitude: number | null
  has_gps: boolean
  all_fields: ExifField[]
}

/** A single EXIF tag/value pair. */
export interface ExifField {
  tag: string
  value: string
  group: string
}

/** A PNG text chunk (tEXt, zTXt, or iTXt). */
export interface TextChunk {
  keyword: string
  text: string
}

// Metadata worker messages

export interface GetMetadataRequest {
  type: MessageType.GetMetadata
  id: number
  data: Uint8Array
}

export interface GetMetadataSuccessResponse {
  type: MessageType.GetMetadata
  id: number
  success: true
  metadata: ImageMetadata
}
