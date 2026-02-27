import { useRef } from 'preact/hooks'
import { ImageConverter } from '../lib/image-converter'

/// Creates and holds a single ImageConverter instance for the lifetime of the component.
export function useWorker(): ImageConverter {
  const ref = useRef<ImageConverter | null>(null)
  if (ref.current === null) {
    ref.current = new ImageConverter()
  }
  return ref.current
}
