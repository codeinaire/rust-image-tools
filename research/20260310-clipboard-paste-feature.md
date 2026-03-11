# Paste from Clipboard Feature - Research

**Researched:** 2026-03-10
**Domain:** Browser Clipboard API, Preact event handling, TypeScript
**Confidence:** HIGH

## Summary

The "Paste from Clipboard" feature is a pure frontend addition that requires no Rust/WASM changes. The feature involves two input paths: (1) intercepting the global `paste` DOM event (Ctrl+V / Cmd+V), and (2) a "Paste image" button that calls the Async Clipboard API (`navigator.clipboard.read()`). Both paths extract image bytes from the clipboard and feed them into the existing `handleFile` pipeline in `useConverter.ts`.

The paste event approach (`ClipboardEvent.clipboardData.files`) has excellent browser support back to Chrome 66, Firefox 63, and Safari 13.1. The Async Clipboard API (`navigator.clipboard.read()`) reached Baseline 2024 status (all major browsers) as of June 2024, with Firefox adding support in version 126. The critical limitation is that **only `image/png` is universally supported** across all browsers for clipboard image reads -- JPEG and WebP clipboard data is typically represented as PNG by the OS clipboard.

The existing codebase is well-structured for this addition. The `handleFile(file, inputMethod)` function in `useConverter.ts` accepts a `File` object and an input method string. The feature requires: (1) extending the `inputMethod` union type to include `'clipboard_paste'`, (2) a new `useClipboardPaste` hook for event management, (3) a paste button in the DropZone UI, and (4) constructing a synthetic `File` from clipboard blob data.

**Primary recommendation:** Implement a dual-path approach -- global `paste` event listener as the primary input (works everywhere, no permissions needed) with an optional "Paste" button using `navigator.clipboard.read()` (requires user gesture, may trigger permission prompt). The paste event path should be the reliable fallback; the button is a convenience for explicit trigger without keyboard.

## Standard Stack

### Core

No new libraries are needed. This feature uses only built-in browser APIs.

| API | Support | Purpose | Why Standard |
| --- | ------- | ------- | ------------ |
| `ClipboardEvent.clipboardData` | Chrome 66+, FF 63+, Safari 13.1+ | Read image data from paste events | Synchronous, no permissions needed, widest browser support |
| `navigator.clipboard.read()` | Chrome 76+, FF 126+, Safari 13.1+ | Programmatic clipboard read on button click | Async API, Baseline 2024, needed for button-triggered paste |
| `ClipboardItem` | Chrome 76+, FF 127+, Safari 13.1+ | Represents clipboard data with typed blobs | Standard interface for Async Clipboard API |

### Supporting

No additional libraries are required. The feature is implementable with standard DOM APIs and existing Preact hooks (`useState`, `useEffect`, `useCallback`).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
| ---------- | --------- | -------- |
| Raw DOM `paste` event listener | React/Preact `onPaste` prop on a container element | `onPaste` on an element only fires when that element (or a child) has focus; document-level listener catches paste regardless of focus, which is the desired UX |
| Custom hook | Third-party clipboard hook library | No library needed -- the implementation is ~40 lines of code; adding a dependency would be over-engineering |

## Architecture Options

| Option | Description | Pros | Cons | Best When |
| ------ | ----------- | ---- | ---- | --------- |
| **A: Dual-path (paste event + button)** | Global `document` paste listener for Ctrl+V plus a "Paste" button that calls `navigator.clipboard.read()` | Covers keyboard and click UX; paste event has broadest support; button is explicit affordance | Two code paths to maintain; button may trigger permission prompt in some browsers | You want both keyboard shortcut and explicit button (recommended) |
| **B: Paste event only** | Only global `document` paste listener, no button | Simplest implementation; zero permission issues; widest compatibility | No discoverability -- users must know Ctrl+V works; no way to paste without keyboard | Minimal implementation, keyboard-savvy users |
| **C: Button only (Async API)** | Only a "Paste" button using `navigator.clipboard.read()` | Explicit, discoverable; no global event listener | Requires user gesture; may show permission prompt; Firefox only supported since v126; no keyboard shortcut | When you want full control over when clipboard is accessed |

**Recommended:** Option A (Dual-path) -- provides the best UX by supporting both keyboard paste (universally understood) and an explicit button for discoverability. The paste event path requires no permissions and has the widest browser support, while the button provides a visual affordance.

## Architecture Patterns

### Recommended Project Structure

```
web/src/
  hooks/
    useClipboardPaste.ts    # New hook: paste event + clipboard read logic
  components/
    DropZone/
      PasteButton.tsx        # New component: "Paste image" button
      index.tsx              # Modified: integrate paste button + hook
  hooks/
    useConverter.ts          # Modified: extend inputMethod type
```

### Pattern 1: useClipboardPaste Hook

**What:** A custom Preact hook that manages the document-level paste event listener and provides a function for button-triggered clipboard reads.
**When to use:** Always -- this encapsulates all clipboard logic in one testable unit.
**Example:**

```typescript
// Source: Derived from MDN Clipboard API docs and web.dev paste-images pattern
import { useEffect, useCallback } from 'preact/hooks'

interface UseClipboardPasteOptions {
  onPaste: (file: File) => void
  onError: (message: string) => void
  enabled: boolean
}

function useClipboardPaste({ onPaste, onError, enabled }: UseClipboardPasteOptions): {
  pasteFromClipboard: () => Promise<void>
  isSupported: boolean
} {
  const isSupported = typeof navigator?.clipboard?.read === 'function'

  useEffect(() => {
    if (!enabled) {
      return
    }

    function handlePaste(e: ClipboardEvent): void {
      const files = e.clipboardData?.files
      if (!files || files.length === 0) {
        return
      }
      const imageFile = Array.from(files).find((f) => f.type.startsWith('image/'))
      if (!imageFile) {
        return
      }
      e.preventDefault()
      const syntheticFile = new File(
        [imageFile],
        `pasted-image-${Date.now()}.${extensionFromMime(imageFile.type)}`,
        { type: imageFile.type },
      )
      onPaste(syntheticFile)
    }

    document.addEventListener('paste', handlePaste)
    return () => {
      document.removeEventListener('paste', handlePaste)
    }
  }, [onPaste, enabled])

  const pasteFromClipboard = useCallback(async () => {
    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith('image/'))
        if (imageType) {
          const blob = await item.getType(imageType)
          const file = new File(
            [blob],
            `pasted-image-${Date.now()}.${extensionFromMime(imageType)}`,
            { type: imageType },
          )
          onPaste(file)
          return
        }
      }
      onError('No image found in clipboard')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        onError('Clipboard access denied. Please allow clipboard permissions.')
      } else {
        onError('Could not read clipboard')
      }
    }
  }, [onPaste, onError])

  return { pasteFromClipboard, isSupported }
}

function extensionFromMime(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  if (mime === 'image/svg+xml') return 'svg'
  if (mime === 'image/bmp') return 'bmp'
  return 'png' // fallback -- clipboard images are almost always PNG
}
```

### Pattern 2: Integration with Existing handleFile

**What:** The paste hook produces a `File` object that feeds directly into the existing `handleFile` pipeline.
**When to use:** Always -- reuses existing validation (file size, megapixels), format detection, and analytics tracking.
**Example:**

```typescript
// In ImageConverter.tsx -- wire clipboard paste into existing pipeline
const { pasteFromClipboard, isSupported } = useClipboardPaste({
  onPaste: (file) => { void handleFile(file, 'clipboard_paste') },
  onError: (msg) => { /* set error state */ },
  enabled: true,
})
```

### Pattern 3: Extending the inputMethod Union

**What:** Add `'clipboard_paste'` to the existing input method discriminator used in analytics.
**When to use:** Required for analytics tracking differentiation.

The current `handleFile` signature is:
```typescript
handleFile(file: File, inputMethod: 'file_picker' | 'drag_drop'): Promise<void>
```
This becomes:
```typescript
handleFile(file: File, inputMethod: 'file_picker' | 'drag_drop' | 'clipboard_paste'): Promise<void>
```

The `DropZone` `Props.onFile` type must also be updated to match.

### Anti-Patterns to Avoid

- **Attaching paste listener to a specific element:** The paste event only fires on focused elements. Attaching to a `<div>` means it only works when that div has focus (requires `tabIndex`). Use `document.addEventListener('paste', ...)` for global interception.
- **Calling `navigator.clipboard.read()` without user gesture:** Most browsers require transient user activation (a recent click/keypress). Calling it on page load or in a timer will fail with `NotAllowedError`.
- **Assuming clipboard images are JPEG/WebP:** Operating systems almost universally convert clipboard images to PNG format. Even if you screenshot a JPEG, the clipboard will contain PNG data. Do not hardcode format assumptions -- use the MIME type from the blob.
- **Forgetting to call `e.preventDefault()`:** If you handle the paste event for an image, call `preventDefault()` to stop the browser from trying to paste into a focused text input or contenteditable element.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
| ------- | ----------- | ----------- | --- |
| Synthetic filename generation | Complex unique ID system | `pasted-image-${Date.now()}.png` | Timestamp is sufficient for uniqueness; no collision risk for single-user client-side app |
| MIME-to-extension mapping | Parsing MIME strings at runtime | Simple lookup object | Only ~5 image MIME types are realistically encountered from clipboard |
| Permission state detection | Polling `navigator.permissions.query()` | Try-catch on `navigator.clipboard.read()` | Firefox and Safari do not support the `clipboard-read` permission name; querying it throws; just handle the error |

## Common Pitfalls

### Pitfall 1: Firefox Permission Model Differences

**What goes wrong:** Code that checks `navigator.permissions.query({ name: 'clipboard-read' })` before reading will throw in Firefox and Safari, because they don't recognize the `clipboard-read` permission name.
**Why it happens:** Only Chromium browsers support the `clipboard-read` permission. Firefox uses an ephemeral paste prompt instead. Safari uses its own permission model.
**How to avoid:** Never pre-check permissions. Just call `navigator.clipboard.read()` inside a try-catch and handle `NotAllowedError` gracefully.

### Pitfall 2: Clipboard Contains Only PNG

**What goes wrong:** Developers expect `image/jpeg` or `image/webp` in the clipboard but only find `image/png`.
**Why it happens:** Operating systems (Windows, macOS, Linux) typically convert all copied images to PNG when placing them on the system clipboard. The Async Clipboard API spec mandates `image/png` as the only required image format.
**How to avoid:** Always check for `image/png` first. The existing `detect_format` WASM function will correctly identify the format from the bytes regardless of what the clipboard reports.

### Pitfall 3: Paste Event vs Async API Race Condition

**What goes wrong:** If the paste button triggers `navigator.clipboard.read()` and the user simultaneously presses Ctrl+V, two images could be processed.
**Why it happens:** The paste event listener and the button handler both fire independently.
**How to avoid:** Use a status check (e.g., `if (status === 'reading' || status === 'converting') return`) in both handlers to prevent double-processing. The existing `useConverter` state machine already gates on status.

### Pitfall 4: Large Screenshots Blocking the Main Thread

**What goes wrong:** A user pastes a 4K or multi-monitor screenshot (can be 30+ MB as PNG). Reading `arrayBuffer()` from the blob can be slow.
**Why it happens:** `Blob.arrayBuffer()` runs on the main thread. Combined with subsequent WASM processing, this can freeze the UI.
**How to avoid:** The existing pipeline already handles this: the converter runs in a Web Worker. The `handleFile` function reads the buffer and delegates to the worker. The "reading" status state already provides visual feedback during this phase.

### Pitfall 5: Mobile Safari Clipboard Limitations

**What goes wrong:** `navigator.clipboard.read()` may not return image data on iOS Safari when copying images from the Photos app or other apps.
**Why it happens:** iOS Safari's clipboard integration is limited -- long-pressing an image in Safari copies the URL, not the image data. Only screenshots (taken via power+volume) reliably produce image data on the clipboard.
**How to avoid:** On mobile, the paste button should be shown but with graceful degradation. If no image is found, show a helpful error message suggesting drag-and-drop or file picker instead. The paste event path (Ctrl+V) is largely irrelevant on mobile anyway (no physical keyboard in most cases).

## Security

### Known Vulnerabilities

No known CVEs or advisories for the browser APIs being used. This feature uses only standard Web Platform APIs with no third-party libraries.

### Architectural Security Risks

| Risk | How It Manifests | Secure Pattern | Anti-Pattern to Avoid |
| ---- | ---------------- | -------------- | --------------------- |
| Clipboard data injection | Malicious content pasted disguised as an image could crash the WASM decoder | Validate data through `detect_format` before processing; handle decode errors gracefully | Processing raw clipboard bytes without format detection |
| Permission prompt fatigue | Repeated `navigator.clipboard.read()` calls trigger browser permission prompts | Only call `read()` on explicit user gesture (button click); prefer paste event for keyboard input | Calling `read()` on page load, on timer, or without user activation |
| Cross-origin clipboard leakage | Clipboard may contain sensitive data from other apps/tabs | Only read image MIME types; ignore text/html; never log clipboard contents | Reading all clipboard items and processing text content |

### Trust Boundaries

- **Paste event data:** Provided by the browser from the OS clipboard. Treat as untrusted input. The existing pipeline already validates via WASM `detect_format` and `getDimensions`, which will reject malformed data with an error.
- **Async Clipboard API data:** Same trust level as paste event data. Browser may sanitize some content (e.g., SVG script removal), but image bytes should still be validated by the WASM decoder.
- **Synthetic filename:** Generated client-side from `Date.now()`. No user input enters the filename, so no injection risk. The filename is used only for the download attribute, never for server-side file operations.

## Code Examples

### Reading Image from Paste Event (Synchronous Clipboard API)

```typescript
// Source: MDN paste event docs + web.dev paste-images pattern
document.addEventListener('paste', (e: ClipboardEvent) => {
  const files = e.clipboardData?.files
  if (!files || files.length === 0) {
    return
  }
  const imageFile = Array.from(files).find((f) => f.type.startsWith('image/'))
  if (!imageFile) {
    return
  }
  e.preventDefault()

  // Create File with synthetic name (clipboard files have empty name)
  const file = new File(
    [imageFile],
    `pasted-image-${Date.now()}.png`,
    { type: imageFile.type },
  )
  // Feed into existing pipeline
  handleFile(file, 'clipboard_paste')
})
```

### Reading Image from Button Click (Async Clipboard API)

```typescript
// Source: MDN Clipboard.read() docs
async function pasteFromButton(): Promise<void> {
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      const imageType = item.types.find((type) => type.startsWith('image/'))
      if (imageType) {
        const blob = await item.getType(imageType)
        const file = new File(
          [blob],
          `pasted-image-${Date.now()}.png`,
          { type: imageType },
        )
        handleFile(file, 'clipboard_paste')
        return
      }
    }
    // No image found in clipboard
    showError('No image found in clipboard')
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      showError('Clipboard access denied')
    } else {
      showError('Could not read clipboard')
    }
  }
}
```

### Feature Detection for Paste Button Visibility

```typescript
// Source: MDN ClipboardItem.supports() docs
function isAsyncClipboardSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard !== 'undefined' &&
    typeof navigator.clipboard.read === 'function'
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
| ------------ | ---------------- | ------------ | ------ |
| `document.execCommand('paste')` | `navigator.clipboard.read()` | Deprecated ~2020, Baseline 2024 | `execCommand` is deprecated and removed from standards; Async Clipboard API is the replacement |
| Firefox clipboard gated behind flag | Firefox 126+ supports `clipboard.read()` natively | Firefox 126 (2024) | No longer need feature flags or fallback for Firefox |
| Only `image/png` in clipboard | `image/svg+xml` added to Chrome | Chrome 130+ (2024) | SVG can now be read from clipboard in Chrome; not relevant for this app's use case but worth noting |
| No permission needed for paste event | Unchanged -- still no permission needed | N/A | Paste events remain the most reliable, zero-permission path for clipboard image access |

**Deprecated/outdated:**

- `document.execCommand('paste')`: Deprecated. Do not use. Replaced by Async Clipboard API.
- `navigator.permissions.query({ name: 'clipboard-read' })`: Not supported by Firefox or Safari. Do not use for feature detection.

## Validation Architecture

### Test Framework

| Property | Value |
| -------- | ----- |
| Unit Framework | Vitest 4.x |
| Unit Config | `web/vitest.config.ts` |
| Quick run command | `cd web && npm run test` |
| E2E Framework | Playwright 1.58.x |
| E2E Config | `web/playwright.config.ts` |
| E2E run command | `cd web && npx playwright test` |

### Requirements to Test Map

| Requirement | Behavior | Test Type | Automated Command | File Exists? |
| ----------- | -------- | --------- | ----------------- | ------------ |
| Paste event intercepts image data | Global paste listener extracts File from ClipboardEvent | unit | `cd web && npx vitest run tests/unit/clipboard-paste.test.ts` | Needs creating |
| Paste event ignores non-image data | Listener does nothing when clipboard has only text | unit | `cd web && npx vitest run tests/unit/clipboard-paste.test.ts` | Needs creating |
| Synthetic filename generated correctly | File name follows `pasted-image-{timestamp}.{ext}` pattern | unit | `cd web && npx vitest run tests/unit/clipboard-paste.test.ts` | Needs creating |
| MIME-to-extension mapping | `image/png` -> `png`, `image/jpeg` -> `jpg`, etc. | unit | `cd web && npx vitest run tests/unit/clipboard-paste.test.ts` | Needs creating |
| Async clipboard read on button click | Button calls `navigator.clipboard.read()` and extracts image | unit (mock API) | `cd web && npx vitest run tests/unit/clipboard-paste.test.ts` | Needs creating |
| Permission denial handled gracefully | NotAllowedError shows user-friendly message | unit (mock API) | `cd web && npx vitest run tests/unit/clipboard-paste.test.ts` | Needs creating |
| No image in clipboard handled | Clipboard items contain no image types -> shows error | unit (mock API) | `cd web && npx vitest run tests/unit/clipboard-paste.test.ts` | Needs creating |
| Paste button hidden when API unsupported | `isSupported` returns false when `clipboard.read` absent | unit | `cd web && npx vitest run tests/unit/clipboard-paste.test.ts` | Needs creating |
| E2E: paste image triggers conversion pipeline | Paste a PNG, verify format detection and conversion works | e2e | `cd web && npx playwright test tests/e2e/clipboard.spec.ts` | Needs creating |
| Analytics: clipboard_paste tracked | `trackImageSelected` called with `input_method: 'clipboard_paste'` | unit | `cd web && npx vitest run tests/unit/clipboard-paste.test.ts` | Needs creating |

### Test Notes

- **Vitest environment:** The config uses `node` environment, not `jsdom`. The unit tests for clipboard will need to mock `document.addEventListener`, `ClipboardEvent`, `navigator.clipboard`, and `File` since these are browser APIs not available in Node. Consider whether tests should use `jsdom` environment locally (via in-file `// @vitest-environment jsdom` comment) or mock manually.
- **Playwright clipboard:** Playwright supports `browserContext.grantPermissions(['clipboard-read', 'clipboard-write'])` for Chromium. It also supports `page.evaluate(() => navigator.clipboard.write(...))` to set clipboard content programmatically. The E2E test should use this approach.

### Gaps (files to create before implementation)

- [ ] `web/tests/unit/clipboard-paste.test.ts` -- unit tests for useClipboardPaste hook logic
- [ ] `web/tests/e2e/clipboard.spec.ts` -- E2E test for paste-to-convert flow
- [ ] `web/src/hooks/useClipboardPaste.ts` -- the hook itself (implementation, not test infra)
- [ ] `web/src/components/DropZone/PasteButton.tsx` -- paste button component

## Open Questions

1. **Should the paste listener be disabled during conversion?**
   - What we know: The existing status state machine prevents double-processing (`status === 'converting'` blocks new files). The `handleFile` function in `useConverter.ts` could be guarded.
   - What's unclear: Whether it's better UX to queue the paste and process after conversion, or silently ignore it, or show a message.
   - Recommendation: Silently ignore pastes while `status === 'converting'` or `status === 'reading'`. This matches existing behavior where drag-drop during conversion is not handled.

2. **Where should the paste button be placed in the DropZone UI?**
   - What we know: The DropZone currently shows "DRAG & DROP IMAGE -- OR CLICK TO SELECT" as the main prompt. The lower section has format selector and convert/download buttons.
   - What's unclear: Whether the paste button should be inline with the main text, below the format list, or as a small icon button.
   - Recommendation: Add "OR PASTE FROM CLIPBOARD" text below the main prompt in the idle state, and a small "Paste" button in the top-right area of the DropZone. Exact placement is a UX decision for the planner.

3. **Should we show a keyboard shortcut hint?**
   - What we know: Power users expect Ctrl+V to work. The global listener will handle it.
   - What's unclear: Whether showing "Ctrl+V to paste" (or "Cmd+V" on Mac) in the UI would help or clutter.
   - Recommendation: Add a subtle hint below the main drop zone text, styled like the existing "HEIC/HEIF accepted as input only" subtext. Detect OS for correct modifier key.

## Sources

### Primary (HIGH confidence)

- [MDN: Clipboard.read()](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/read) -- API spec, browser compatibility, code examples, security requirements
- [MDN: Element paste event](https://developer.mozilla.org/en-US/docs/Web/API/Element/paste_event) -- ClipboardEvent interface, clipboardData property
- [MDN: Clipboard API overview](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API) -- Security considerations, Permissions-Policy requirements
- [web.dev: How to paste images](https://web.dev/patterns/clipboard/paste-images) -- Progressive enhancement pattern, browser support matrix (Chrome 76+, FF 127+, Safari 13.1+ for async; Chrome 66+, FF 63+, Safari 13.1+ for paste event)
- [web.dev: Unblocking clipboard access](https://web.dev/articles/async-clipboard) -- Permission model, secure context requirements, Permissions-Policy for iframes

### Secondary (MEDIUM confidence)

- [Chrome Developers: SVG support for Async Clipboard API](https://developer.chrome.com/blog/svg-support-for-async-clipboard-api) -- Confirmed only PNG + SVG for images; JPEG not natively supported in clipboard reads -- Published: 2024, Accessed: 2026-03-10
- [W3C Clipboard API spec](https://www.w3.org/TR/clipboard-apis/) -- Normative specification for clipboard events and Async API -- Accessed: 2026-03-10
- [Chrome Developers: Permissions Policy](https://developer.chrome.com/docs/privacy-security/permissions-policy) -- Clipboard-read/write policy for iframes -- Accessed: 2026-03-10

### Tertiary (LOW confidence)

- [bobbyhadz: Handle onPaste event in React](https://bobbyhadz.com/blog/react-onpaste-event) -- React paste event patterns (applicable to Preact) -- Accessed: 2026-03-10
- [Can I Use: clipboard](https://caniuse.com/?search=clipboard) -- Browser support tables (referenced but specific numbers pulled from MDN) -- Accessed: 2026-03-10

## Metadata

**Confidence breakdown:**

- Clipboard API browser support: HIGH -- verified via MDN official docs and web.dev
- Paste event approach: HIGH -- well-documented, stable API since 2018+
- Async Clipboard API for button: HIGH -- Baseline 2024, verified across sources
- Firefox/Safari permission quirks: HIGH -- documented on MDN, confirmed by multiple sources
- Mobile browser support: MEDIUM -- iOS Safari limitations noted in search results but not fully verified with current iOS version
- UX placement recommendations: LOW -- based on general patterns, not user research specific to this app

**Research date:** 2026-03-10
