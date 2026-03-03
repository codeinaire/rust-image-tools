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

export enum MessageType {
  Init = "init",
  DetectFormat = "detect_format",
  ConvertImage = "convert_image",
  GetDimensions = "get_dimensions",
  Error = "error",
}
