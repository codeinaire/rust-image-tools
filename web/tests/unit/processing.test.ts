import { describe, it, expect } from 'vitest'
import {
  buildOperations,
  type ProcessingState,
  type ResizeState,
  type CropState,
  type AdjustmentsState,
} from '../../src/hooks/useProcessing'

const DEFAULT_RESIZE: ResizeState = {
  enabled: false,
  width: 0,
  height: 0,
  filter: 'lanczos3',
  lockAspectRatio: true,
}

const DEFAULT_CROP: CropState = {
  enabled: false,
  x: 0,
  y: 0,
  width: 0,
  height: 0,
}

const DEFAULT_ADJUSTMENTS: AdjustmentsState = {
  brightness: 0,
  contrast: 0,
  hueRotate: 0,
  blurSigma: 0,
  blurType: 'gaussian',
  unsharpenSigma: 0,
  unsharpenThreshold: 0,
}

function makeState(overrides: Partial<ProcessingState> = {}): ProcessingState {
  return {
    resize: overrides.resize ?? DEFAULT_RESIZE,
    crop: overrides.crop ?? DEFAULT_CROP,
    adjustments: overrides.adjustments ?? DEFAULT_ADJUSTMENTS,
  }
}

describe('buildOperations', () => {
  it('returns empty array for default state', () => {
    const ops = buildOperations(makeState())
    expect(ops).toEqual([])
  })

  it('includes resize operation when enabled with valid dimensions', () => {
    const ops = buildOperations(
      makeState({
        resize: { ...DEFAULT_RESIZE, enabled: true, width: 100, height: 50 },
      }),
    )
    expect(ops).toEqual([{ type: 'resize', width: 100, height: 50, filter: 'lanczos3' }])
  })

  it('excludes resize when enabled but width is 0', () => {
    const ops = buildOperations(
      makeState({
        resize: { ...DEFAULT_RESIZE, enabled: true, width: 0, height: 50 },
      }),
    )
    expect(ops).toEqual([])
  })

  it('excludes resize when disabled', () => {
    const ops = buildOperations(
      makeState({
        resize: { ...DEFAULT_RESIZE, enabled: false, width: 100, height: 50 },
      }),
    )
    expect(ops).toEqual([])
  })

  it('includes crop operation when enabled with valid dimensions', () => {
    const ops = buildOperations(
      makeState({
        crop: { enabled: true, x: 10, y: 20, width: 100, height: 50 },
      }),
    )
    expect(ops).toEqual([{ type: 'crop', x: 10, y: 20, width: 100, height: 50 }])
  })

  it('excludes crop when enabled but width is 0', () => {
    const ops = buildOperations(
      makeState({
        crop: { enabled: true, x: 0, y: 0, width: 0, height: 50 },
      }),
    )
    expect(ops).toEqual([])
  })

  it('includes brightness adjustment when non-zero', () => {
    const ops = buildOperations(
      makeState({
        adjustments: { ...DEFAULT_ADJUSTMENTS, brightness: 50 },
      }),
    )
    expect(ops).toEqual([{ type: 'brighten', value: 50 }])
  })

  it('includes contrast adjustment when non-zero', () => {
    const ops = buildOperations(
      makeState({
        adjustments: { ...DEFAULT_ADJUSTMENTS, contrast: -30 },
      }),
    )
    expect(ops).toEqual([{ type: 'contrast', value: -30 }])
  })

  it('includes hue rotation when non-zero', () => {
    const ops = buildOperations(
      makeState({
        adjustments: { ...DEFAULT_ADJUSTMENTS, hueRotate: 180 },
      }),
    )
    expect(ops).toEqual([{ type: 'hue_rotate', degrees: 180 }])
  })

  it('includes gaussian blur when sigma > 0', () => {
    const ops = buildOperations(
      makeState({
        adjustments: { ...DEFAULT_ADJUSTMENTS, blurSigma: 5, blurType: 'gaussian' },
      }),
    )
    expect(ops).toEqual([{ type: 'blur', sigma: 5 }])
  })

  it('includes fast blur when blurType is fast and sigma > 0', () => {
    const ops = buildOperations(
      makeState({
        adjustments: { ...DEFAULT_ADJUSTMENTS, blurSigma: 5, blurType: 'fast' },
      }),
    )
    expect(ops).toEqual([{ type: 'fast_blur', sigma: 5 }])
  })

  it('excludes blur when sigma is 0', () => {
    const ops = buildOperations(
      makeState({
        adjustments: { ...DEFAULT_ADJUSTMENTS, blurSigma: 0 },
      }),
    )
    expect(ops).toEqual([])
  })

  it('includes unsharpen when sigma > 0', () => {
    const ops = buildOperations(
      makeState({
        adjustments: { ...DEFAULT_ADJUSTMENTS, unsharpenSigma: 3, unsharpenThreshold: 5 },
      }),
    )
    expect(ops).toEqual([{ type: 'unsharpen', sigma: 3, threshold: 5 }])
  })

  it('excludes unsharpen when sigma is 0', () => {
    const ops = buildOperations(
      makeState({
        adjustments: { ...DEFAULT_ADJUSTMENTS, unsharpenSigma: 0, unsharpenThreshold: 5 },
      }),
    )
    expect(ops).toEqual([])
  })

  it('emits operations in fixed order: resize -> crop -> adjustments', () => {
    const ops = buildOperations(
      makeState({
        resize: { enabled: true, width: 200, height: 100, filter: 'nearest', lockAspectRatio: false },
        crop: { enabled: true, x: 0, y: 0, width: 100, height: 50 },
        adjustments: { ...DEFAULT_ADJUSTMENTS, brightness: 20, contrast: 10 },
      }),
    )
    expect(ops.length).toBe(4)
    expect(ops[0]?.type).toBe('resize')
    expect(ops[1]?.type).toBe('crop')
    expect(ops[2]?.type).toBe('brighten')
    expect(ops[3]?.type).toBe('contrast')
  })

  it('includes multiple adjustments in correct order', () => {
    const ops = buildOperations(
      makeState({
        adjustments: {
          brightness: 10,
          contrast: 20,
          hueRotate: 90,
          blurSigma: 3,
          blurType: 'gaussian',
          unsharpenSigma: 2,
          unsharpenThreshold: 5,
        },
      }),
    )
    expect(ops.length).toBe(5)
    expect(ops[0]?.type).toBe('brighten')
    expect(ops[1]?.type).toBe('contrast')
    expect(ops[2]?.type).toBe('hue_rotate')
    expect(ops[3]?.type).toBe('blur')
    expect(ops[4]?.type).toBe('unsharpen')
  })

  it('uses specified resize filter', () => {
    const ops = buildOperations(
      makeState({
        resize: { enabled: true, width: 100, height: 50, filter: 'nearest', lockAspectRatio: true },
      }),
    )
    const resizeOp = ops[0]
    expect(resizeOp?.type).toBe('resize')
    if (resizeOp?.type === 'resize') {
      expect(resizeOp.filter).toBe('nearest')
    }
  })
})
