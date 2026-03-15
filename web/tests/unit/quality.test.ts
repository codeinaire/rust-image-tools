import { describe, it, expect } from 'vitest'
import { getQualityForFormat, FORMATS_WITH_QUALITY } from '../../src/lib/quality'
import { ValidFormat } from '../../src/types'

describe('getQualityForFormat', () => {
  it('returns the quality value for JPEG', () => {
    expect(getQualityForFormat(ValidFormat.Jpeg, 80)).toBe(80)
    expect(getQualityForFormat(ValidFormat.Jpeg, 1)).toBe(1)
    expect(getQualityForFormat(ValidFormat.Jpeg, 100)).toBe(100)
  })

  it('returns the quality value for WebP', () => {
    expect(getQualityForFormat(ValidFormat.WebP, 50)).toBe(50)
  })

  it('returns the quality value for PNG', () => {
    expect(getQualityForFormat(ValidFormat.Png, 75)).toBe(75)
  })

  it('returns undefined for formats without quality support', () => {
    const formatsWithoutQuality: ValidFormat[] = [
      ValidFormat.Gif,
      ValidFormat.Bmp,
      ValidFormat.Tiff,
      ValidFormat.Ico,
      ValidFormat.Tga,
      ValidFormat.Qoi,
    ]

    for (const format of formatsWithoutQuality) {
      expect(getQualityForFormat(format, 80)).toBeUndefined()
    }
  })
})

describe('FORMATS_WITH_QUALITY', () => {
  it('contains exactly JPEG, WebP, and PNG', () => {
    expect(FORMATS_WITH_QUALITY.size).toBe(3)
    expect(FORMATS_WITH_QUALITY.has(ValidFormat.Jpeg)).toBe(true)
    expect(FORMATS_WITH_QUALITY.has(ValidFormat.WebP)).toBe(true)
    expect(FORMATS_WITH_QUALITY.has(ValidFormat.Png)).toBe(true)
  })

  it('does not contain other formats', () => {
    expect(FORMATS_WITH_QUALITY.has(ValidFormat.Gif)).toBe(false)
    expect(FORMATS_WITH_QUALITY.has(ValidFormat.Bmp)).toBe(false)
    expect(FORMATS_WITH_QUALITY.has(ValidFormat.Tiff)).toBe(false)
    expect(FORMATS_WITH_QUALITY.has(ValidFormat.Ico)).toBe(false)
    expect(FORMATS_WITH_QUALITY.has(ValidFormat.Tga)).toBe(false)
    expect(FORMATS_WITH_QUALITY.has(ValidFormat.Qoi)).toBe(false)
  })
})
