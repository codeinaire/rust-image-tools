import { useMemo } from 'preact/hooks'
import { ImageConverter } from '../lib/image-converter'

/// Creates and holds a single ImageConverter instance for the lifetime of the component.
export function useImageConverter(): ImageConverter {
  return useMemo(() => new ImageConverter(), [])
}
