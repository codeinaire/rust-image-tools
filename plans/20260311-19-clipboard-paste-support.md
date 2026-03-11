# Plan: Clipboard Paste Support

**Date:** 2026-03-11
**Status:** Complete
**Research:** research/20260310-clipboard-paste-feature.md

## Goal

Allow users to paste images from the clipboard (via Ctrl+V/Cmd+V or the Async Clipboard API) and feed them into the existing conversion pipeline, with no new dependencies.

## Approach

Implement a dual-path clipboard input: (1) a global `document` paste event listener that intercepts Ctrl+V/Cmd+V and extracts image data from `ClipboardEvent.clipboardData.files`, and (2) a clickable "OR PASTE" text in the DropZone prompt that calls `navigator.clipboard.read()` for explicit paste. Both paths construct a synthetic `File` object and pass it to the existing `handleFile` pipeline with a new `'clipboard_paste'` input method. The paste event path requires no permissions and has the widest support (Chrome 66+, FF 63+, Safari 13.1+); the Async Clipboard API path requires a user gesture and may trigger a permission prompt but provides a visible affordance. No Rust/WASM changes are needed. The research strongly recommends this dual-path approach for maximum UX coverage.

## Critical

- Only read clipboard items with MIME types starting with `image/` -- never read text, HTML, or other clipboard content to avoid cross-origin data leakage.
- Never pre-check clipboard permissions via `navigator.permissions.query({ name: 'clipboard-read' })` -- it throws in Firefox and Safari. Use try-catch on `navigator.clipboard.read()` instead.
- Call `e.preventDefault()` when handling a paste event that contains an image, to prevent the browser from pasting into any focused text input.
- The paste listener must be disabled (no-op) while `status === 'converting'` or `status === 'reading'` to prevent double-processing.
- Clipboard images are almost always PNG regardless of original format. Do not hardcode format assumptions -- use the MIME type from the blob and let WASM `detect_format` identify the true format from bytes.

## Steps

### 1. Define `InputMethod` type alias

- [x] In `web/src/hooks/useConverter.ts`, extract the inline `'file_picker' | 'drag_drop'` union into an exported type alias `InputMethod = 'file_picker' | 'drag_drop' | 'clipboard_paste'` near the top of the file (below imports). Update the `handleFile` parameter signature to use `InputMethod` instead of the inline union.

### 2. Update analytics to accept `clipboard_paste`

- [x] In `web/src/analytics.ts`, update the `input_method` property type in the `trackImageSelected` function parameter from `'file_picker' | 'drag_drop'` to `'file_picker' | 'drag_drop' | 'clipboard_paste'`. (Alternatively, import and use the `InputMethod` type from `useConverter.ts` if the import is clean; if it creates a circular dependency, just inline the union.)

### 3. Update DropZone `Props.onFile` type

- [x] In `web/src/components/DropZone/index.tsx`, update the `Props.onFile` callback type from `(file: File, inputMethod: 'file_picker' | 'drag_drop') => void` to `(file: File, inputMethod: 'file_picker' | 'drag_drop' | 'clipboard_paste') => void`. (Use the `InputMethod` type if imported, or inline the union.)

### 4. Create `useClipboardPaste` hook

- [x] Create `web/src/hooks/useClipboardPaste.ts` with the following structure:
  - Define an `extensionFromMime(mime: string): string` helper that maps `image/png` -> `png`, `image/jpeg` -> `jpg`, `image/webp` -> `webp`, `image/gif` -> `gif`, `image/bmp` -> `bmp`, with `png` as fallback.
  - Define an interface `UseClipboardPasteOptions` with: `onPaste: (file: File) => void`, `onError: (message: string) => void`, `enabled: boolean`.
  - Export `useClipboardPaste(options)` that returns `{ pasteFromClipboard: () => Promise<void>, isSupported: boolean }`.
  - Inside the hook, compute `isSupported` via feature detection: `typeof navigator !== 'undefined' && typeof navigator.clipboard !== 'undefined' && typeof navigator.clipboard.read === 'function'`.
  - Register a `document.addEventListener('paste', handler)` inside a `useEffect` that is only active when `enabled` is true. The handler: gets `e.clipboardData?.files`, finds the first file with `type.startsWith('image/')`, calls `e.preventDefault()`, wraps in a synthetic `File` with name `pasted-image-${Date.now()}.${extensionFromMime(mime)}`, and calls `onPaste`. If no image file is found, return silently (do not call `onError` -- the user may be pasting text into a different context).
  - Provide `pasteFromClipboard` as a `useCallback` async function that calls `navigator.clipboard.read()`, iterates `ClipboardItem` types for an `image/*` match, gets the blob, wraps in a synthetic `File`, and calls `onPaste`. On `NotAllowedError`, call `onError('Clipboard access denied. Please allow clipboard permissions.')`. On no image found, call `onError('No image found in clipboard')`. On other errors, call `onError('Could not read clipboard')`.
  - Clean up the event listener on unmount or when `enabled` changes.
  - Add JSDoc to all exported functions.

### 5. Integrate hook in `ImageConverter.tsx`

- [x] In `web/src/components/ImageConverter.tsx`, import `useClipboardPaste` from `../hooks/useClipboardPaste`.
- [x] Call the hook, passing: `onPaste: (file) => { void handleFile(file, 'clipboard_paste') }`, `onError: (msg) => { /* set a local error state or reuse state.error */ }`, `enabled: state.status !== 'converting' && state.status !== 'reading'`.
- [x] For `onError`: set converter error state. Since `useConverter` does not expose a `setError` method, either (a) add a `setError(msg: string)` function to the `useConverter` return value, or (b) manage a local `clipboardError` state in `ImageConverter.tsx` and display it alongside `state.error`. Option (a) is cleaner -- add `setError` to `useConverter` that sets `status: 'error'` and the error message.
- [x] Pass `pasteFromClipboard` and `isSupported` down to `DropZone` as new props.

### 6. Add `setError` to `useConverter` (if needed per step 5)

- [x] In `web/src/hooks/useConverter.ts`, add a `setError(message: string): void` function that calls `setState` to set `status: 'error'`, `error: message`, `fileInfo: null`, `result: null`, `showProgress: false`. Add it to the return object.

### 7. Update DropZone UI for paste affordance

- [x] In `web/src/components/DropZone/index.tsx`, accept two new props: `onPaste: () => void` (calls `pasteFromClipboard`) and `pasteSupported: boolean`.
- [x] In the idle state (no `fileInfo`, not reading, not `isDragOver`), change `mainText` from `'DRAG & DROP IMAGE — OR CLICK TO SELECT'` to `'DRAG & DROP — CLICK TO SELECT — OR PASTE'`.
- [x] Make the "OR PASTE" portion clickable. Approach: split the prompt into a `<span>` for "DRAG & DROP -- CLICK TO SELECT" (which triggers file picker on click as it does now) and a separate `<span>` for "OR PASTE" with `onClick` bound to `onPaste` (with `e.stopPropagation()` to prevent triggering the file picker click). Only render the "OR PASTE" span when `pasteSupported` is true.
- [x] Style the "OR PASTE" text to match the existing yellow prompt style. Optionally add a subtle hover underline or brightness change to indicate it is clickable.

### 8. Wire props through ImageConverter to DropZone

- [x] In `web/src/components/ImageConverter.tsx`, pass `onPaste={pasteFromClipboard}` and `pasteSupported={isSupported}` to the `<DropZone>` component.

### 9. Unit tests for `useClipboardPaste` hook

- [x] Create `web/tests/unit/clipboard-paste.test.ts` with the following test cases. Use `// @vitest-environment jsdom` at the top of the file to get browser API mocks:
  - **Paste event extracts image file:** Simulate a `ClipboardEvent` with a `DataTransfer` containing an image file. Assert `onPaste` is called with a `File` whose name matches `pasted-image-{timestamp}.png`.
  - **Paste event ignores non-image data:** Simulate a paste with only text files. Assert `onPaste` is NOT called.
  - **Paste event calls preventDefault:** Assert `e.preventDefault()` is called when an image is found.
  - **Paste event is no-op when disabled:** Set `enabled: false`, simulate paste. Assert `onPaste` is NOT called.
  - **extensionFromMime mapping:** Test all MIME types map correctly (including fallback to `png`).
  - **Async clipboard read succeeds:** Mock `navigator.clipboard.read()` to return a `ClipboardItem` with `image/png`. Call `pasteFromClipboard()`. Assert `onPaste` is called.
  - **Async clipboard read -- no image:** Mock `navigator.clipboard.read()` to return items with no image type. Assert `onError` is called with 'No image found in clipboard'.
  - **Async clipboard read -- NotAllowedError:** Mock `navigator.clipboard.read()` to throw a `DOMException('', 'NotAllowedError')`. Assert `onError` is called with the permission-denied message.
  - **isSupported reflects API availability:** Assert `isSupported` is `true` when `navigator.clipboard.read` exists, `false` when it does not.
  - **Analytics: clipboard_paste tracked:** Mock `handleFile` and verify it is called with `'clipboard_paste'` as the input method.

### 10. E2E test for paste-to-convert flow

- [x] Create `web/tests/e2e/clipboard.spec.ts` with a Playwright test:
  - Grant clipboard permissions via `context.grantPermissions(['clipboard-read', 'clipboard-write'])`.
  - Load a small PNG test image as bytes, write to clipboard via `page.evaluate()` using `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])`.
  - Dispatch a paste event (`page.keyboard.press('Control+V')` or simulate via `page.evaluate`).
  - Assert that the DropZone transitions from idle to showing file info (source format detected, dimensions shown).
  - Note: This test only works reliably in Chromium. Mark with `test.skip` for WebKit/Firefox if needed.

### 11. Static analysis check

- [x] Run `cd /Users/nousunio/Repos/Learnings/claude-code/rust-image-tools/web && npm run check:all` and fix any type errors, lint warnings, or formatting issues introduced by the new code.

## Security

**Known vulnerabilities:** No known vulnerabilities identified as of 2026-03-10. This feature uses only built-in browser APIs with no new third-party dependencies.

**Architectural risks:**

| Risk | Mitigation |
| ---- | ---------- |
| Clipboard data injection (malformed bytes disguised as image) | All clipboard data passes through the existing `handleFile` pipeline which calls WASM `detect_format` and `getDimensions`. Malformed data will be rejected with a user-facing error. No raw clipboard bytes are processed without format validation. |
| Permission prompt fatigue | `navigator.clipboard.read()` is only called on explicit user click ("OR PASTE" text). Never called on page load, on timers, or without user activation. The paste event path requires no permissions at all. |
| Cross-origin clipboard leakage | Only `image/*` MIME types are read from clipboard items. Text, HTML, and other types are ignored. Clipboard contents are never logged. |
| Trust boundary: paste event data | Treated as untrusted. Validated by WASM decoder via `detect_format` before any processing. Invalid data produces a user-facing error, not a crash. |
| Trust boundary: Async Clipboard API data | Same trust level as paste event. Blob bytes are wrapped in a `File` and fed through the same validation pipeline. |
| Synthetic filename | Generated from `Date.now()` only -- no user input enters the filename. Used only for the download attribute. No injection risk. |

## Open Questions

- **Should the paste listener be disabled during conversion?** (Resolved: Yes. Pass `enabled: state.status !== 'converting' && state.status !== 'reading'` to the hook. This matches existing behavior where drag-drop during conversion is effectively ignored.)
- **Where should the paste button be placed?** (Resolved: Per user preference, replace the main prompt text to include "OR PASTE" as a third inline option. No separate button component.)
- **Should we show a keyboard shortcut hint?** (Resolved: Per user preference, no hint. Rely on users knowing Ctrl+V/Cmd+V natively.)

## Implementation Discoveries

- **jsdom not usable for unit tests:** The vitest config comment notes jsdom requires Node >=20.19. Additionally, jsdom fails at runtime with an ESM compatibility error (`require() of ES Module` from `html-encoding-sniffer`). Unit tests were written without jsdom, using mock objects for `ClipboardEvent`/`FileList` and extracting the handler logic for direct testing.
- **ESLint `prefer-for-of`:** The initial `for (let i = 0; ...)` loop over `FileList` triggered the `@typescript-eslint/prefer-for-of` rule. Fixed by using `Array.from(files).find(...)`.
- **ESLint `no-misused-promises`:** Passing `pasteFromClipboard` (async) directly to the `onPaste` prop (void return) triggered `no-misused-promises`. Fixed by wrapping with `() => { void pasteFromClipboard() }`.
- **`vi.fn()` mock type incompatibility:** Vitest `Mock` type is not assignable to `() => void` in strict mode. Fixed by using a `MockPasteEvent` interface with `preventDefault: () => void` and assigning the spy separately in the test that checks it.
- **`useCallback` import:** Added `useCallback` import to `ImageConverter.tsx` for memoizing `onClipboardPaste` and `onClipboardError` callbacks passed to the hook.

## Verification

- [x] Paste event extracts image file from ClipboardEvent -- unit -- `cd /Users/nousunio/Repos/Learnings/claude-code/rust-image-tools/web && npx vitest run tests/unit/clipboard-paste.test.ts` -- Automatic
- [x] Paste event ignores non-image clipboard data -- unit -- `cd /Users/nousunio/Repos/Learnings/claude-code/rust-image-tools/web && npx vitest run tests/unit/clipboard-paste.test.ts` -- Automatic
- [x] Paste event calls preventDefault on image paste -- unit -- `cd /Users/nousunio/Repos/Learnings/claude-code/rust-image-tools/web && npx vitest run tests/unit/clipboard-paste.test.ts` -- Automatic
- [x] Paste event is no-op when `enabled` is false -- unit -- `cd /Users/nousunio/Repos/Learnings/claude-code/rust-image-tools/web && npx vitest run tests/unit/clipboard-paste.test.ts` -- Automatic
- [x] MIME-to-extension mapping correctness -- unit -- `cd /Users/nousunio/Repos/Learnings/claude-code/rust-image-tools/web && npx vitest run tests/unit/clipboard-paste.test.ts` -- Automatic
- [x] Async clipboard read succeeds and produces File -- unit -- `cd /Users/nousunio/Repos/Learnings/claude-code/rust-image-tools/web && npx vitest run tests/unit/clipboard-paste.test.ts` -- Automatic
- [x] Async clipboard read handles NotAllowedError gracefully -- unit -- `cd /Users/nousunio/Repos/Learnings/claude-code/rust-image-tools/web && npx vitest run tests/unit/clipboard-paste.test.ts` -- Automatic
- [x] Async clipboard read handles no-image-in-clipboard -- unit -- `cd /Users/nousunio/Repos/Learnings/claude-code/rust-image-tools/web && npx vitest run tests/unit/clipboard-paste.test.ts` -- Automatic
- [x] `isSupported` reflects API availability -- unit -- `cd /Users/nousunio/Repos/Learnings/claude-code/rust-image-tools/web && npx vitest run tests/unit/clipboard-paste.test.ts` -- Automatic
- [x] Analytics tracks `clipboard_paste` input method -- unit -- `cd /Users/nousunio/Repos/Learnings/claude-code/rust-image-tools/web && npx vitest run tests/unit/clipboard-paste.test.ts` -- Automatic
- [x] E2E paste image triggers conversion pipeline (Chromium) -- e2e -- `cd /Users/nousunio/Repos/Learnings/claude-code/rust-image-tools/web && npx playwright test tests/e2e/clipboard.spec.ts --project=chromium` -- Automatic
- [ ] "OR PASTE" text visible in idle DropZone state -- manual -- Open the app, verify the prompt reads "DRAG & DROP -- CLICK TO SELECT -- OR PASTE" -- Manual
- [ ] Clicking "OR PASTE" triggers clipboard read and loads image -- manual -- Copy an image to clipboard, click "OR PASTE" in DropZone, verify image is loaded and format detected -- Manual
- [ ] Ctrl+V / Cmd+V pastes image from clipboard into converter -- manual -- Copy an image, press Ctrl+V on the page, verify image loads -- Manual
- [ ] Paste during conversion is silently ignored -- manual -- Start a conversion, press Ctrl+V, verify no double-processing or error -- Manual
- [x] Static analysis passes -- lint -- `cd /Users/nousunio/Repos/Learnings/claude-code/rust-image-tools/web && npm run check:all` -- Automatic
