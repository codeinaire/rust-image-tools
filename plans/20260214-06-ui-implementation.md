# Plan: UI Implementation

**Date:** 2026-02-14
**Status:** Done
**PR Scope:** Medium-Large — full interactive UI
**Depends On:** Plan 05 (Web Worker + WASM integration)

## Goal

Implement the complete interactive UI: file input (click + drag-and-drop), automatic source format detection and display, target format selector, convert button, image preview, download button, and before/after metadata display (dimensions, file sizes).

## Approach

All DOM manipulation lives in `web/src/ui.ts`. The module hooks into the HTML elements created in Plan 04 and uses the Worker wrapper functions from Plan 05. The UI flow follows PLANNING.md's data flow: select file → read as ArrayBuffer → send to Worker for format detection → display source info → user picks target format → convert → show preview + download.

Blob URLs are created for preview/download and revoked when no longer needed to prevent memory leaks.

## Steps

1. Create `web/src/ui.ts` with DOM manipulation logic
2. Implement file input:
   - Click-to-browse via `<input type="file">`
   - Drag-and-drop with visual feedback (dragover/dragleave/drop)
3. On file selection:
   - Read file as `ArrayBuffer` → `Uint8Array`
   - Send to Worker for `detect_format` + `get_dimensions`
   - Display source format, dimensions, and file size in the UI
4. Implement target format selector (PNG, JPEG, GIF, BMP dropdown)
5. Implement convert button:
   - Send bytes + target format to Worker
   - Disable button during conversion
6. On conversion result:
   - Create `Blob` → `URL.createObjectURL()` for preview
   - Display preview image
   - Show download button
   - Display output file size and size comparison
7. Implement download button (programmatic `<a>` click with download attribute)
8. Implement Blob URL cleanup (`URL.revokeObjectURL()`)
9. Wire everything together in `main.ts`

## Todo

- [x] Create `web/src/ui.ts`
- [x] Implement file input — click-to-browse:
  - [x] Wire `<input type="file">` with accept attribute for supported image types
  - [x] Style the file input (hidden input + visible drop zone)
- [x] Implement drag-and-drop:
  - [x] `dragover` event — prevent default, add visual highlight
  - [x] `dragleave` event — remove visual highlight
  - [x] `drop` event — extract file, remove highlight
- [x] On file selected/dropped:
  - [x] Read file as `ArrayBuffer` using `file.arrayBuffer()`
  - [x] Convert to `Uint8Array`
  - [x] Call Worker `detect_format()` — display detected format
  - [x] Call Worker `get_dimensions()` — display width x height
  - [x] Display file size (human-readable, e.g., "4.2 MB")
- [x] Implement target format selector:
  - [x] Dropdown with options: PNG, JPEG, GIF, BMP
  - [x] Pre-select a sensible default (PNG is default in HTML)
- [x] Implement convert button:
  - [x] On click: send bytes + target format to Worker
  - [x] Disable button and show loading state during conversion
  - [x] Re-enable on completion or error
- [x] On conversion success:
  - [x] Create `Blob` from result bytes with correct MIME type
  - [x] Create `URL.createObjectURL()` for preview
  - [x] Show `<img>` preview with the blob URL
  - [x] Show output file size
  - [x] Show size comparison (e.g., "4.2 MB → 15.8 MB (+276%)")
  - [x] Show download button
- [x] Implement download:
  - [x] `<a>` element with `href` = blob URL, `download` = filename with correct extension
- [x] Implement Blob URL cleanup:
  - [x] Revoke previous blob URLs when new conversion starts or on file change
- [x] Wire UI initialization in `main.ts`
- [ ] Test full flow in browser: select file → see info → pick format → convert → preview → download

## Implementation Notes

- `ui.ts` exports a single `initUI()` function called from `main.ts`
- DOM elements are cached once during `initUI()` to avoid repeated lookups
- `detect_format` and `get_dimensions` are called in parallel via `Promise.all` for faster file analysis
- File size validation (200 MB) happens before reading bytes to Worker; dimension validation (100 MP) happens after `get_dimensions` returns
- Progress bar animates to 90% during conversion and snaps to 100% on completion (estimated progress pattern from PLANNING.md)
- Circular import between `main.ts` ↔ `ui.ts` is safe because `ui.ts` only accesses `converter` inside event handler functions, not at module evaluation time
- `script type="module"` is deferred by default, so `initUI()` runs after DOM is parsed

## Key Details from PLANNING.md

**Data flow:**
1. User drops/selects image file
2. JS reads file as `ArrayBuffer` → `Uint8Array`
3. JS posts bytes to Web Worker
4. Worker calls `detect_format()` and `get_dimensions()`
5. User selects target format, clicks Convert
6. Worker calls `convert_image()`
7. Worker posts result bytes back (transferable, zero-copy)
8. JS creates `Blob` → `URL.createObjectURL()` for preview and download

**Output formats available in selector:** PNG, JPEG, GIF, BMP (not WebP — encode not supported in V1)
