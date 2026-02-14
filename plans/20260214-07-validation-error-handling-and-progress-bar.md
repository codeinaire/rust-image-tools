# Plan: Validation, Error Handling & Estimated Progress Bar

**Date:** 2026-02-14
**Status:** Draft
**PR Scope:** Medium — validation guards, error UX, progress animation
**Depends On:** Plan 06 (UI implementation)

## Goal

Add frontend validation guards (200 MB file size limit, 100 MP dimension limit), user-friendly error display for all failure modes, and an estimated progress bar that animates during conversion.

## Approach

**Validation:** File size is checked immediately on file selection (before reading into memory). Dimension check happens after the Worker returns dimensions from `get_dimensions()`. Both rejections prevent conversion from starting and show clear error messages.

**Error handling:** All error paths (validation rejections, decode failures, unsupported formats, Worker crashes) surface as user-friendly messages in a dedicated error display area. No silent failures.

**Progress bar:** Frontend-only estimation using format-pair timing rates. A CSS transition animates from 0% → 90% over the estimated duration. On Worker response, it snaps to 100%. No Rust or Worker changes needed.

## Steps

1. Add file size validation (reject > 200 MB before `FileReader`)
2. Add dimension validation (reject > 100 MP after `get_dimensions()` response)
3. Create error display UI component (show/hide, error message text, dismissible)
4. Handle all error paths: validation rejections, Worker errors, WASM errors
5. Implement estimated progress bar:
   - Estimation model with format-pair rates
   - CSS transition animation (0% → 90% over estimated duration)
   - Snap to 100% on Worker response
   - Reset on new conversion

## Todo

- [ ] Add file size validation:
  - [ ] Check `file.size` immediately on selection/drop
  - [ ] Reject files > 200 MB (200 * 1024 * 1024 bytes)
  - [ ] Show error: "File too large. Maximum file size is 200 MB."
  - [ ] Prevent file from being read into memory
- [ ] Add dimension validation:
  - [ ] After `get_dimensions()` returns, calculate megapixels (width * height / 1,000,000)
  - [ ] Reject images > 100 MP
  - [ ] Show error: "Image dimensions too large. Maximum is 100 megapixels."
  - [ ] Prevent conversion from starting
- [ ] Implement error display UI:
  - [ ] Dedicated error area in the UI (hidden by default)
  - [ ] Show/hide functions
  - [ ] Clear error when new file is selected
  - [ ] Style with Tailwind (red/warning colors, clear message)
- [ ] Handle Worker error paths:
  - [ ] Decode failure → show "Failed to decode image" with details
  - [ ] Unsupported format → show "Unsupported format" message
  - [ ] Worker crash/unresponsive → show generic error with retry suggestion
- [ ] Implement estimated progress bar:
  - [ ] Define format-pair timing constants:
    - [ ] JPEG → PNG: base 20ms, 40ms/MP
    - [ ] PNG → JPEG: base 20ms, 25ms/MP
    - [ ] WebP → PNG: base 20ms, 35ms/MP
    - [ ] BMP → JPEG: base 20ms, 25ms/MP
    - [ ] Fallback: base 30ms, 50ms/MP
  - [ ] Calculate `estimated_ms` from source format, target format, and megapixels
  - [ ] On conversion start: set CSS transition `width: 0% → 90%` over `estimated_ms * 0.9`
  - [ ] Progress bar eases toward 90% and holds
  - [ ] On Worker response (success or error): transition to 100%, then show result
  - [ ] If Worker responds before 90%: snap to 100% (feels fast)
  - [ ] Reset progress bar on new conversion start
- [ ] Style progress bar with Tailwind (smooth animation, appropriate colors)
- [ ] Test validation: try file > 200 MB, verify rejection
- [ ] Test validation: try image > 100 MP (if possible), verify rejection
- [ ] Test error display: load corrupted file, verify error shown
- [ ] Test progress bar: convert image, verify animation and snap behavior

## Key Details from PLANNING.md

**V1 limits:**
- Max file size: 200 MB
- Max decoded image: ~100 megapixels (~400 MB RGBA)
- Pipeline total stays under ~1.6 GB (well within 4 GB WASM memory)

**Failure modes:**
- Desktop: WASM `memory.grow()` returns `-1` or `ArrayBuffer` throws `RangeError` — both catchable
- Mobile (iOS): Jetsam kills process silently — must enforce limits upfront

**Progress bar estimation model:**
```
estimated_ms = base_ms[format_pair] + (megapixels * ms_per_mp[format_pair])
```

**Progress bar behavior:**
- Never reaches 100% on its own — eases to ~90% and holds
- Snaps to 100% on Worker response
- "90% stall" is a well-known UX pattern users accept intuitively
