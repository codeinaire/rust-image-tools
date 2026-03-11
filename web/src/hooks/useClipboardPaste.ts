import { useEffect, useCallback } from 'preact/hooks'

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
  onError: (message: string) => void
  enabled: boolean
}

/**
 * Hook that provides clipboard paste support for images via two paths:
 * (1) a global `paste` event listener for Ctrl+V/Cmd+V, and
 * (2) a `pasteFromClipboard` function that uses the Async Clipboard API.
 *
 * The paste event listener is only active when `enabled` is `true`.
 */
export function useClipboardPaste(options: UseClipboardPasteOptions): {
  pasteFromClipboard: () => Promise<void>
  isSupported: boolean
} {
  const { onPaste, onError, enabled } = options

  const isSupported =
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard !== 'undefined' &&
    typeof navigator.clipboard.read === 'function'

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

  /**
   * Reads image data from the clipboard using the Async Clipboard API.
   *
   * Requires a user gesture to trigger. May prompt the user for clipboard
   * read permission in some browsers.
   */
  const pasteFromClipboard = useCallback(async (): Promise<void> => {
    try {
      const items = await navigator.clipboard.read()

      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'))
        if (imageType) {
          const blob = await item.getType(imageType)
          const extension = extensionFromMime(imageType)
          const syntheticFile = new File([blob], `pasted-image-${Date.now()}.${extension}`, {
            type: imageType,
          })
          onPaste(syntheticFile)
          return
        }
      }

      onError('No image found in clipboard')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        onError('Clipboard access denied. Please allow clipboard permissions.')
      } else {
        onError('Could not read clipboard')
      }
    }
  }, [onPaste, onError])

  return { pasteFromClipboard, isSupported }
}
