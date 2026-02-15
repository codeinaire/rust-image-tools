# Plan: UI Implementation

**Date:** 2026-02-14
**Status:** Draft
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

- [ ] Create `web/src/ui.ts`
- [ ] Implement file input — click-to-browse:
  - [ ] Wire `<input type="file">` with accept attribute for supported image types
  - [ ] Style the file input (hidden input + visible drop zone)
- [ ] Implement drag-and-drop:
  - [ ] `dragover` event — prevent default, add visual highlight
  - [ ] `dragleave` event — remove visual highlight
  - [ ] `drop` event — extract file, remove highlight
- [ ] On file selected/dropped:
  - [ ] Read file as `ArrayBuffer` using `FileReader` or `file.arrayBuffer()`
  - [ ] Convert to `Uint8Array`
  - [ ] Call Worker `detect_format()` — display detected format
  - [ ] Call Worker `get_dimensions()` — display width x height
  - [ ] Display file size (human-readable, e.g., "4.2 MB")
- [ ] Implement target format selector:
  - [ ] Dropdown with options: PNG, JPEG, GIF, BMP
  - [ ] Pre-select a sensible default (e.g., PNG, or auto-pick based on source format)
- [ ] Implement convert button:
  - [ ] On click: send bytes + target format to Worker
  - [ ] Disable button and show loading state during conversion
  - [ ] Re-enable on completion or error
- [ ] On conversion success:
  - [ ] Create `Blob` from result bytes with correct MIME type
  - [ ] Create `URL.createObjectURL()` for preview
  - [ ] Show `<img>` preview with the blob URL
  - [ ] Show output file size
  - [ ] Show size comparison (e.g., "4.2 MB → 15.8 MB (+276%)")
  - [ ] Show download button
- [ ] Implement download:
  - [ ] Create `<a>` element with `href` = blob URL, `download` = filename with correct extension
  - [ ] Programmatic click to trigger download
- [ ] Implement Blob URL cleanup:
  - [ ] Revoke previous blob URLs when new conversion starts or on file change
- [ ] Wire UI initialization in `main.ts`
- [ ] Test full flow in browser: select file → see info → pick format → convert → preview → download

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
