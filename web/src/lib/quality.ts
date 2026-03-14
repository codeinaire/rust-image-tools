import { ValidFormat } from '../types'

/** Formats that support a quality parameter (1-100). */
export const FORMATS_WITH_QUALITY: ReadonlySet<ValidFormat> = new Set([
  ValidFormat.Jpeg,
  ValidFormat.WebP,
  ValidFormat.Png,
])

/**
 * Returns the quality value to pass to the converter for a given format.
 * Returns undefined for formats that do not support quality control.
 */
export function getQualityForFormat(
  targetFormat: ValidFormat,
  quality: number,
): number | undefined {
  if (FORMATS_WITH_QUALITY.has(targetFormat)) {
    return quality
  }
  return undefined
}
