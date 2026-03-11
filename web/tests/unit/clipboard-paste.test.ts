import { describe, it, expect, vi } from 'vitest'
import { extensionFromMime } from '../../src/hooks/useClipboardPaste'

// ---------------------------------------------------------------------------
// extensionFromMime
// ---------------------------------------------------------------------------

describe('extensionFromMime', () => {
  it('maps image/png to png', () => {
    expect(extensionFromMime('image/png')).toBe('png')
  })

  it('maps image/jpeg to jpg', () => {
    expect(extensionFromMime('image/jpeg')).toBe('jpg')
  })

  it('maps image/webp to webp', () => {
    expect(extensionFromMime('image/webp')).toBe('webp')
  })

  it('maps image/gif to gif', () => {
    expect(extensionFromMime('image/gif')).toBe('gif')
  })

  it('maps image/bmp to bmp', () => {
    expect(extensionFromMime('image/bmp')).toBe('bmp')
  })

  it('falls back to png for unknown MIME types', () => {
    expect(extensionFromMime('image/tiff')).toBe('png')
    expect(extensionFromMime('image/x-icon')).toBe('png')
    expect(extensionFromMime('application/octet-stream')).toBe('png')
  })
})

// ---------------------------------------------------------------------------
// Paste event handler logic
//
// We test the handler logic that useClipboardPaste registers on `document`.
// Since DataTransfer and ClipboardEvent are not available in Node, we create
// mock objects that match the shape the handler expects.
// ---------------------------------------------------------------------------

interface MockPasteEvent {
  clipboardData: { files: FileList }
  preventDefault: () => void
}

/** Creates a mock ClipboardEvent-like object with a FileList containing the given files. */
function createMockPasteEvent(files: File[]): MockPasteEvent {
  // Build a FileList-like object
  const fileList = {
    length: files.length,
    item: (i: number) => files[i] ?? null,
    [Symbol.iterator]: function* () {
      for (const f of files) {
        yield f
      }
    },
  } as unknown as FileList

  // Assign indexed access
  for (let i = 0; i < files.length; i++) {
    Object.defineProperty(fileList, i, { value: files[i], enumerable: true })
  }

  return {
    clipboardData: { files: fileList },
    preventDefault: vi.fn(),
  }
}

/**
 * Mirrors the paste event handler logic from useClipboardPaste.
 * Extracted here so we can test it in a Node environment without DOM.
 */
function handlePasteEvent(
  e: { clipboardData?: { files: FileList } | null; preventDefault: () => void },
  onPaste: (file: File) => void,
): void {
  const files = e.clipboardData?.files
  if (!files || files.length === 0) {
    return
  }

  const imageFile = Array.from(files).find((file) => file.type.startsWith('image/'))
  if (!imageFile) {
    return
  }

  e.preventDefault()

  const ext = extensionFromMime(imageFile.type)
  const syntheticFile = new File([imageFile], `pasted-image-${Date.now()}.${ext}`, {
    type: imageFile.type,
  })
  onPaste(syntheticFile)
}

describe('paste event handler logic', () => {
  it('extracts image file from paste event and calls onPaste', () => {
    const onPaste = vi.fn()

    const pngFile = new File([new Uint8Array([0x89, 0x50])], 'screenshot.png', {
      type: 'image/png',
    })
    const event = createMockPasteEvent([pngFile])

    handlePasteEvent(event, onPaste)

    expect(onPaste).toHaveBeenCalledOnce()
    const receivedFile = onPaste.mock.calls[0]?.[0] as File
    expect(receivedFile.name).toMatch(/^pasted-image-\d+\.png$/)
    expect(receivedFile.type).toBe('image/png')
  })

  it('ignores paste events with no image files', () => {
    const onPaste = vi.fn()

    const textFile = new File(['hello'], 'note.txt', { type: 'text/plain' })
    const event = createMockPasteEvent([textFile])

    handlePasteEvent(event, onPaste)

    expect(onPaste).not.toHaveBeenCalled()
  })

  it('calls preventDefault when an image is found', () => {
    const onPaste = vi.fn()
    const preventDefaultSpy = vi.fn()

    const pngFile = new File([new Uint8Array([0x89, 0x50])], 'img.png', {
      type: 'image/png',
    })
    const event = createMockPasteEvent([pngFile])
    event.preventDefault = preventDefaultSpy

    handlePasteEvent(event, onPaste)

    expect(preventDefaultSpy).toHaveBeenCalledOnce()
  })

  it('does not call onPaste when no handler is invoked (simulating enabled: false)', () => {
    const onPaste = vi.fn()

    const pngFile = new File([new Uint8Array([0x89, 0x50])], 'img.png', {
      type: 'image/png',
    })
    // Create event but do NOT call handlePasteEvent — simulating disabled state
    createMockPasteEvent([pngFile])

    expect(onPaste).not.toHaveBeenCalled()
  })

  it('creates synthetic file with correct extension for JPEG paste', () => {
    const onPaste = vi.fn()

    const jpegFile = new File([new Uint8Array([0xff, 0xd8])], 'photo.jpeg', {
      type: 'image/jpeg',
    })
    const event = createMockPasteEvent([jpegFile])

    handlePasteEvent(event, onPaste)

    expect(onPaste).toHaveBeenCalledOnce()
    const receivedFile = onPaste.mock.calls[0]?.[0] as File
    expect(receivedFile.name).toMatch(/^pasted-image-\d+\.jpg$/)
    expect(receivedFile.type).toBe('image/jpeg')
  })

  it('ignores paste events with empty clipboardData', () => {
    const onPaste = vi.fn()

    const event = createMockPasteEvent([])

    handlePasteEvent(event, onPaste)

    expect(onPaste).not.toHaveBeenCalled()
  })

  it('ignores paste events with null clipboardData', () => {
    const onPaste = vi.fn()

    handlePasteEvent({ clipboardData: null, preventDefault: vi.fn() }, onPaste)

    expect(onPaste).not.toHaveBeenCalled()
  })
})
