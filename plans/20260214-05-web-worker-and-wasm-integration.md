# Plan: Web Worker & WASM Integration

**Date:** 2026-02-14
**Status:** Done
**PR Scope:** Medium — Worker setup, WASM loading, message protocol
**Depends On:** Plan 01 (Rust crate must build to WASM), Plan 04 (frontend scaffold)

## Goal

Create the Web Worker that loads and initializes the WASM module, and establish the message protocol between the main thread and the Worker for image conversion operations.

## Approach

The Worker loads the WASM module on initialization and exposes the Rust functions (`detect_format`, `convert_image`, `get_dimensions`) via a structured message protocol. Byte arrays are transferred (not copied) between threads using transferable objects for zero-copy O(1) performance. The main thread creates the Worker eagerly on page load and communicates via `postMessage`.

## Steps

1. Create `web/src/worker.ts`:
   - Import and initialize WASM module (`init()` from wasm-pack output)
   - Define message types (TypeScript interfaces for requests/responses)
   - Handle incoming messages: `detect_format`, `convert_image`, `get_dimensions`
   - Use transferable objects for byte array transfer (`postMessage(result, [result.buffer])`)
   - Post initialization status back to main thread
2. Update `web/src/main.ts`:
   - Create Worker instance
   - Define typed message handlers for Worker responses
   - Export/expose functions that send messages to Worker and return Promises
   - Handle Worker errors
3. Ensure WASM binary is accessible to Parcel bundler (configure asset path if needed)
4. Test that Worker initializes and can handle a basic conversion round-trip

## Todo

- [x] Define TypeScript interfaces for Worker message protocol:
  - [x] Request types: `DetectFormatRequest`, `ConvertImageRequest`, `GetDimensionsRequest`
  - [x] Response types: `DetectFormatResponse`, `ConvertImageResponse`, `GetDimensionsResponse`, `ErrorResponse`, `InitResponse`
- [x] Create `web/src/worker.ts`:
  - [x] Import WASM `init()` and exported functions
  - [x] Call `init()` on Worker start, post `InitResponse` with timing
  - [x] Add `onmessage` handler dispatching to appropriate WASM function
  - [x] Use `postMessage(result, [result.buffer])` for transferable byte arrays
  - [x] Wrap WASM calls in try/catch, return structured errors
- [x] Update `web/src/main.ts`:
  - [x] Create Worker instance (`new Worker(...)`)
  - [x] Add `onmessage` handler for Worker responses
  - [x] Create Promise-based wrapper functions for each WASM operation
  - [x] Handle Worker `onerror` events
  - [x] Track WASM init timing for `app_loaded` event (used later in Plan 09)
- [x] Configure Parcel to serve WASM binary correctly (may need `--dist-dir` or asset config)
- [x] Verify WASM module loads in Worker without errors
- [ ] Verify a test conversion works end-to-end (main thread → Worker → WASM → Worker → main thread)
- [ ] Verify transferable objects are used (buffer is neutered after transfer)

## Implementation Notes

### Files created/modified

- **`web/src/worker-types.ts`** (new) — Shared TypeScript interfaces for the Worker message protocol. Defines `WorkerRequest` (union of 3 request types), `WorkerResponse` (union of 6 response types), and `ImageDimensions` helper.
- **`web/src/worker.ts`** (new) — Web Worker that imports wasm-pack output, auto-initializes WASM on creation, and dispatches incoming messages to the appropriate WASM function. Uses `postMessage(response, [result.buffer])` for zero-copy transfer of converted image bytes.
- **`web/src/main.ts`** (updated) — Creates Worker eagerly on page load, manages a pending request map with numeric IDs, and exposes `ensureReady()`, `detectFormat()`, `convertImage()`, and `getDimensions()` as async Promise-based functions. Handles Worker `onerror` by rejecting all pending requests.

### Key decisions

- **Worker-specific `postMessage` typing**: Used a `declare function postMessage(...)` at the top of `worker.ts` to provide the Worker-specific `postMessage(message, transfer[])` overload, since TypeScript defaults to `Window.postMessage` types without the `WebWorker` lib.
- **Eager initialization**: Worker is created on page load (not lazily on first use) so WASM is ready before the user interacts with the converter.
- **No input buffer transfer**: Input buffers are copied (not transferred) to the Worker so the main thread retains the data for potential reuse (e.g., converting the same image to multiple formats). Only output buffers are transferred back (zero-copy).
- **Parcel configuration**: No additional Parcel config needed — Parcel v2 natively handles `new Worker(new URL(...), { type: 'module' })` and resolves the WASM binary through the wasm-bindgen glue code's `new URL('...wasm', import.meta.url)` pattern.

## Key Details from PLANNING.md

**Message flow:**
1. Main thread posts `Uint8Array` + operation type to Worker
2. Worker calls WASM function
3. Worker posts result bytes back using transferable objects (zero-copy)

**Transferable objects:** `postMessage(result, [result.buffer])` — O(1) transfer regardless of size.

**WASM initialization:** Worker imports `init()` from wasm-pack generated JS glue, calls it once on startup.

**Performance principle:** Minimize JS↔WASM boundary crossings. Pass entire image buffer in one call, return result in one call.
