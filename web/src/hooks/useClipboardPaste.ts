import { useEffect } from 'preact/hooks'

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
}

/**
 * Maps an image MIME type to a file extension.
 *
 * Returns the matching extension for known image types, or `'png'` as a fallback.
 */
export function extensionFromMime(mime: string): string {
  return MIME_TO_EXTENSION[mime] ?? 'png'
}

interface UseClipboardPasteOptions {
  onPaste: (file: File) => void
  enabled: boolean
}

/**
 * Hook that listens for global `paste` events and extracts image files.
 *
 * When `enabled` is `true`, intercepts Ctrl+V/Cmd+V paste events on the
 * document. If the clipboard contains an image file, it is wrapped in a
 * synthetic `File` and passed to `onPaste`. Non-image paste events are
 * ignored silently.
 */
export function useClipboardPaste(options: UseClipboardPasteOptions): void {
  const { onPaste, enabled } = options

  useEffect(() => {
    if (!enabled) {
      return
    }

    function handler(e: Event): void {
      const clipboardEvent = e as ClipboardEvent
      const files = clipboardEvent.clipboardData?.files
      if (!files || files.length === 0) {
        return
      }

      const imageFile = Array.from(files).find((file) => file.type.startsWith('image/'))

      if (!imageFile) {
        return
      }

      clipboardEvent.preventDefault()

      const extension = extensionFromMime(imageFile.type)
      const syntheticFile = new File([imageFile], `pasted-image-${Date.now()}.${extension}`, {
        type: imageFile.type,
      })
      onPaste(syntheticFile)
    }

    document.addEventListener('paste', handler)
    return () => {
      document.removeEventListener('paste', handler)
    }
  }, [enabled, onPaste])
}
