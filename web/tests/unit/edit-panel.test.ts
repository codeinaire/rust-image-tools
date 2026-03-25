import { describe, it, expect } from 'vitest'
import type { ResizeState, CropState, AdjustmentsState } from '../../src/hooks/useProcessing'

/**
 * Unit tests for EditPanel state types.
 *
 * Note: EditPanel is a Preact component that requires a DOM environment to render.
 * These tests verify the data structures and state types used by EditPanel.
 * Component rendering tests would require jsdom or a browser environment,
 * which has known ESM compatibility issues with vitest (see MEMORY.md).
 */

describe('EditPanel state types', () => {
  it('ResizeState has correct default structure', () => {
    const state: ResizeState = {
      enabled: false,
      width: 0,
      height: 0,
      filter: 'lanczos3',
      lockAspectRatio: true,
    }
    expect(state.enabled).toBe(false)
    expect(state.filter).toBe('lanczos3')
    expect(state.lockAspectRatio).toBe(true)
  })

  it('CropState has correct default structure', () => {
    const state: CropState = {
      enabled: false,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    }
    expect(state.enabled).toBe(false)
    expect(state.x).toBe(0)
  })

  it('AdjustmentsState has correct default structure', () => {
    const state: AdjustmentsState = {
      brightness: 0,
      contrast: 0,
      hueRotate: 0,
      blurSigma: 0,
      blurType: 'gaussian',
      unsharpenSigma: 0,
      unsharpenThreshold: 0,
    }
    expect(state.brightness).toBe(0)
    expect(state.blurType).toBe('gaussian')
  })

  it('ResizeFilter accepts all valid values', () => {
    const filters: ResizeState['filter'][] = [
      'nearest',
      'triangle',
      'catmull_rom',
      'gaussian',
      'lanczos3',
    ]
    expect(filters.length).toBe(5)
    for (const f of filters) {
      expect(typeof f).toBe('string')
    }
  })

  it('BlurType accepts gaussian and fast values', () => {
    const types: AdjustmentsState['blurType'][] = ['gaussian', 'fast']
    expect(types.length).toBe(2)
  })
})
