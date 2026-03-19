export enum ValidFormat {
  Png = 'png',
  Jpeg = 'jpeg',
  WebP = 'webp',
  Gif = 'gif',
  Bmp = 'bmp',
  Qoi = 'qoi',
  Ico = 'ico',
  Tiff = 'tiff',
  Tga = 'tga',
}

/** ValidFormat extended with HEIC, which is input-only and not a conversion target. */
export type InputFormat = ValidFormat | 'heic'

export enum MessageType {
  Init = 'init',
  DetectFormat = 'detect_format',
  ConvertImage = 'convert_image',
  GetDimensions = 'get_dimensions',
  BenchmarkImages = 'benchmark_images',
  BenchmarkResult = 'benchmark_result',
  BenchmarkComplete = 'benchmark_complete',
  GetMetadata = 'get_metadata',
  Error = 'error',
}
