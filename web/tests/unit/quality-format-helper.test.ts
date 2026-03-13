import { describe, it, expect } from 'vitest'
import { getQualityForFormat } from '../../src/hooks/useConverter'
import { ValidFormat } from '../../src/types'

describe('getQualityForFormat', () => {
  it('returns the raw quality value for JPEG', () => {
    expect(getQualityForFormat(ValidFormat.Jpeg, 80)).toBe(80)
    expect(getQualityForFormat(ValidFormat.Jpeg, 1)).toBe(1)
    expect(getQualityForFormat(ValidFormat.Jpeg, 100)).toBe(100)
  })

  it('returns the raw quality value for WebP', () => {
    expect(getQualityForFormat(ValidFormat.WebP, 50)).toBe(50)
  })

  it('returns the raw quality value for PNG', () => {
    expect(getQualityForFormat(ValidFormat.Png, 75)).toBe(75)
  })

  it('returns undefined for GIF', () => {
    expect(getQualityForFormat(ValidFormat.Gif, 80)).toBeUndefined()
  })

  it('returns undefined for BMP', () => {
    expect(getQualityForFormat(ValidFormat.Bmp, 80)).toBeUndefined()
  })

  it('returns undefined for TIFF', () => {
    expect(getQualityForFormat(ValidFormat.Tiff, 80)).toBeUndefined()
  })

  it('returns undefined for ICO', () => {
    expect(getQualityForFormat(ValidFormat.Ico, 80)).toBeUndefined()
  })

  it('returns undefined for TGA', () => {
    expect(getQualityForFormat(ValidFormat.Tga, 80)).toBeUndefined()
  })

  it('returns undefined for QOI', () => {
    expect(getQualityForFormat(ValidFormat.Qoi, 80)).toBeUndefined()
  })
})
