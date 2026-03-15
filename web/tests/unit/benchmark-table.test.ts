import { describe, it, expect } from 'vitest'
import { formatTime, findSmallestFormat } from '../../src/components/BenchmarkTable'
import { ValidFormat } from '../../src/types'
import type { BenchmarkEntry } from '../../src/hooks/useBenchmark'

describe('formatTime', () => {
  it('returns milliseconds for values under 1000', () => {
    expect(formatTime(0)).toBe('0 ms')
    expect(formatTime(1)).toBe('1 ms')
    expect(formatTime(500)).toBe('500 ms')
    expect(formatTime(999)).toBe('999 ms')
  })

  it('returns seconds with one decimal for values at or above 1000', () => {
    expect(formatTime(1000)).toBe('1.0 s')
    expect(formatTime(1500)).toBe('1.5 s')
    expect(formatTime(2345)).toBe('2.3 s')
    expect(formatTime(10000)).toBe('10.0 s')
  })

  it('handles the boundary at exactly 1000 ms', () => {
    expect(formatTime(999)).toBe('999 ms')
    expect(formatTime(1000)).toBe('1.0 s')
  })
})

describe('findSmallestFormat', () => {
  it('returns null for an empty array', () => {
    expect(findSmallestFormat([])).toBeNull()
  })

  it('returns the format with the smallest output size', () => {
    const results: BenchmarkEntry[] = [
      {
        format: ValidFormat.Png,
        success: true,
        outputSize: 5000,
        conversionMs: 10,
        changePercent: -20,
      },
      {
        format: ValidFormat.Jpeg,
        success: true,
        outputSize: 2000,
        conversionMs: 5,
        changePercent: -50,
      },
      {
        format: ValidFormat.WebP,
        success: true,
        outputSize: 3000,
        conversionMs: 8,
        changePercent: -30,
      },
    ]
    expect(findSmallestFormat(results)).toBe(ValidFormat.Jpeg)
  })

  it('ignores failed entries', () => {
    const results: BenchmarkEntry[] = [
      {
        format: ValidFormat.Png,
        success: false,
        error: 'conversion failed',
      },
      {
        format: ValidFormat.Jpeg,
        success: true,
        outputSize: 4000,
        conversionMs: 10,
        changePercent: -10,
      },
    ]
    expect(findSmallestFormat(results)).toBe(ValidFormat.Jpeg)
  })

  it('returns null when all entries have failed', () => {
    const results: BenchmarkEntry[] = [
      {
        format: ValidFormat.Png,
        success: false,
        error: 'conversion failed',
      },
      {
        format: ValidFormat.Jpeg,
        success: false,
        error: 'unsupported',
      },
    ]
    expect(findSmallestFormat(results)).toBeNull()
  })

  it('returns the first format when multiple have the same smallest size', () => {
    const results: BenchmarkEntry[] = [
      {
        format: ValidFormat.Png,
        success: true,
        outputSize: 1000,
        conversionMs: 10,
        changePercent: 0,
      },
      {
        format: ValidFormat.WebP,
        success: true,
        outputSize: 1000,
        conversionMs: 5,
        changePercent: 0,
      },
    ]
    // First entry wins on equal size since < is strict
    expect(findSmallestFormat(results)).toBe(ValidFormat.Png)
  })

  it('handles a single successful entry', () => {
    const results: BenchmarkEntry[] = [
      {
        format: ValidFormat.Gif,
        success: true,
        outputSize: 8000,
        conversionMs: 20,
        changePercent: 50,
      },
    ]
    expect(findSmallestFormat(results)).toBe(ValidFormat.Gif)
  })

  it('handles a mix of successful and failed entries with smallest being successful', () => {
    const results: BenchmarkEntry[] = [
      {
        format: ValidFormat.Tiff,
        success: false,
        error: 'timeout',
      },
      {
        format: ValidFormat.Bmp,
        success: true,
        outputSize: 50000,
        conversionMs: 2,
        changePercent: 100,
      },
      {
        format: ValidFormat.Qoi,
        success: true,
        outputSize: 3000,
        conversionMs: 1,
        changePercent: -40,
      },
      {
        format: ValidFormat.Ico,
        success: false,
        error: 'too large',
      },
    ]
    expect(findSmallestFormat(results)).toBe(ValidFormat.Qoi)
  })
})
