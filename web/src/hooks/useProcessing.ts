import { useState, useCallback, useMemo } from 'preact/hooks'
import type { ProcessingOperation, ResizeFilter } from '../types'

/** State for the resize operation section. */
export interface ResizeState {
  enabled: boolean
  width: number
  height: number
  filter: ResizeFilter
  lockAspectRatio: boolean
}

/** State for the crop operation section. */
export interface CropState {
  enabled: boolean
  x: number
  y: number
  width: number
  height: number
}

/** Blur type selection: Gaussian or fast (box) blur. */
export type BlurType = 'gaussian' | 'fast'

/** State for all adjustment operations. */
export interface AdjustmentsState {
  brightness: number
  contrast: number
  hueRotate: number
  blurSigma: number
  blurType: BlurType
  unsharpenSigma: number
  unsharpenThreshold: number
}

/** Complete processing state for all operation sections. */
export interface ProcessingState {
  resize: ResizeState
  crop: CropState
  adjustments: AdjustmentsState
}

/** Default resize state (disabled, zeroed dimensions). */
const DEFAULT_RESIZE: ResizeState = {
  enabled: false,
  width: 0,
  height: 0,
  filter: 'lanczos3',
  lockAspectRatio: true,
}

/** Default crop state (disabled, zeroed region). */
const DEFAULT_CROP: CropState = {
  enabled: false,
  x: 0,
  y: 0,
  width: 0,
  height: 0,
}

/** Default adjustments state (all neutral values). */
const DEFAULT_ADJUSTMENTS: AdjustmentsState = {
  brightness: 0,
  contrast: 0,
  hueRotate: 0,
  blurSigma: 0,
  blurType: 'gaussian',
  unsharpenSigma: 0,
  unsharpenThreshold: 0,
}

/** Default processing state with all sections disabled/neutral. */
const DEFAULT_STATE: ProcessingState = {
  resize: DEFAULT_RESIZE,
  crop: DEFAULT_CROP,
  adjustments: DEFAULT_ADJUSTMENTS,
}

/**
 * Converts the current processing state into an ordered array of ProcessingOperation objects.
 * Operations are emitted in fixed order: resize -> crop -> adjustments.
 * Only enabled sections with non-neutral values produce operations.
 */
export function buildOperations(state: ProcessingState): ProcessingOperation[] {
  const ops: ProcessingOperation[] = []

  // Resize (if enabled and dimensions are valid)
  if (state.resize.enabled && state.resize.width > 0 && state.resize.height > 0) {
    ops.push({
      type: 'resize',
      width: state.resize.width,
      height: state.resize.height,
      filter: state.resize.filter,
    })
  }

  // Crop (if enabled and dimensions are valid)
  if (state.crop.enabled && state.crop.width > 0 && state.crop.height > 0) {
    ops.push({
      type: 'crop',
      x: state.crop.x,
      y: state.crop.y,
      width: state.crop.width,
      height: state.crop.height,
    })
  }

  // Adjustments (only add operations with non-zero/non-default values)
  const adj = state.adjustments

  if (adj.brightness !== 0) {
    ops.push({ type: 'brighten', value: adj.brightness })
  }

  if (adj.contrast !== 0) {
    ops.push({ type: 'contrast', value: adj.contrast })
  }

  if (adj.hueRotate !== 0) {
    ops.push({ type: 'hue_rotate', degrees: adj.hueRotate })
  }

  if (adj.blurSigma > 0) {
    if (adj.blurType === 'fast') {
      ops.push({ type: 'fast_blur', sigma: adj.blurSigma })
    } else {
      ops.push({ type: 'blur', sigma: adj.blurSigma })
    }
  }

  if (adj.unsharpenSigma > 0) {
    ops.push({
      type: 'unsharpen',
      sigma: adj.unsharpenSigma,
      threshold: adj.unsharpenThreshold,
    })
  }

  return ops
}

/** Return type of the useProcessing hook. */
export interface UseProcessingReturn {
  /** Current processing state for all operation sections. */
  state: ProcessingState
  /** The ordered array of active processing operations. */
  operations: ProcessingOperation[]
  /** Whether any operations are currently active (non-default). */
  hasActiveOperations: boolean
  /** Update the resize section state. */
  updateResize: (update: Partial<ResizeState>) => void
  /** Update the crop section state. */
  updateCrop: (update: Partial<CropState>) => void
  /** Update the adjustments section state. */
  updateAdjustments: (update: Partial<AdjustmentsState>) => void
  /** Reset a specific operation section to its defaults. */
  resetOperation: (section: 'resize' | 'crop' | 'adjustments') => void
  /** Reset all operation sections to their defaults. */
  resetAll: () => void
}

/**
 * Hook for managing image processing operation state.
 *
 * Provides state management for resize, crop, and adjustment operations,
 * with functions to update individual sections, reset sections, and
 * build the operations array for the processing pipeline.
 *
 * @param sourceWidth - Original image width (used for aspect ratio calculations)
 * @param sourceHeight - Original image height (used for aspect ratio calculations)
 */
export function useProcessing(sourceWidth: number, sourceHeight: number): UseProcessingReturn {
  const [state, setState] = useState<ProcessingState>(DEFAULT_STATE)
  const aspectRatio = sourceHeight > 0 ? sourceWidth / sourceHeight : 1

  /** Updates resize state, handling aspect ratio lock when applicable. */
  const updateResize = useCallback(
    (update: Partial<ResizeState>) => {
      setState((prev) => {
        const next = { ...prev.resize, ...update }

        // Handle aspect ratio lock: when width or height changes, update the other
        if (next.lockAspectRatio && aspectRatio > 0) {
          const updatedWidth = 'width' in update ? update.width : undefined
          const updatedHeight = 'height' in update ? update.height : undefined
          if (updatedWidth !== undefined && updatedWidth > 0) {
            next.height = Math.round(updatedWidth / aspectRatio)
          } else if (updatedHeight !== undefined && updatedHeight > 0) {
            next.width = Math.round(updatedHeight * aspectRatio)
          }
        }

        return { ...prev, resize: next }
      })
    },
    [aspectRatio],
  )

  /** Updates crop state. */
  const updateCrop = useCallback((update: Partial<CropState>) => {
    setState((prev) => ({
      ...prev,
      crop: { ...prev.crop, ...update },
    }))
  }, [])

  /** Updates adjustments state. */
  const updateAdjustments = useCallback((update: Partial<AdjustmentsState>) => {
    setState((prev) => ({
      ...prev,
      adjustments: { ...prev.adjustments, ...update },
    }))
  }, [])

  /** Resets a specific operation section to its defaults. */
  const resetOperation = useCallback((section: 'resize' | 'crop' | 'adjustments') => {
    setState((prev) => {
      if (section === 'resize') {
        return { ...prev, resize: DEFAULT_RESIZE }
      }
      if (section === 'crop') {
        return { ...prev, crop: DEFAULT_CROP }
      }
      return { ...prev, adjustments: DEFAULT_ADJUSTMENTS }
    })
  }, [])

  /** Resets all operation sections to their defaults. */
  const resetAll = useCallback(() => {
    setState(DEFAULT_STATE)
  }, [])

  const operations = useMemo(() => buildOperations(state), [state])
  const hasActiveOperations = operations.length > 0

  return {
    state,
    operations,
    hasActiveOperations,
    updateResize,
    updateCrop,
    updateAdjustments,
    resetOperation,
    resetAll,
  }
}
