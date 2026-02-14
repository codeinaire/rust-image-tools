# Plan: Web Worker & WASM Integration

**Date:** 2026-02-14
**Status:** Draft
**PR Scope:** Medium — Worker setup, WASM loading, message protocol
**Depends On:** Plan 01 (Rust crate must build to WASM), Plan 04 (frontend scaffold)

## Goal

Create the Web Worker that loads and initializes the WASM module, and establish the message protocol between the main thread and the Worker for image conversion operations.

## Approach

The Worker loads the WASM module on initialization and exposes the Rust functions (`detect_format`, `convert_image`, `get_dimensions`) via a structured message protocol. Byte arrays are transferred (not copied) between threads using transferable objects for zero-copy O(1) performance. The main thread creates the Worker lazily or on page load and communicates via `postMessage`.

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

- [ ] Define TypeScript interfaces for Worker message protocol:
  - [ ] Request types: `DetectFormatRequest`, `ConvertImageRequest`, `GetDimensionsRequest`
  - [ ] Response types: `DetectFormatResponse`, `ConvertImageResponse`, `GetDimensionsResponse`, `ErrorResponse`, `InitResponse`
- [ ] Create `web/src/worker.ts`:
  - [ ] Import WASM `init()` and exported functions
  - [ ] Call `init()` on Worker start, post `InitResponse` with timing
  - [ ] Add `onmessage` handler dispatching to appropriate WASM function
  - [ ] Use `postMessage(result, [result.buffer])` for transferable byte arrays
  - [ ] Wrap WASM calls in try/catch, return structured errors
- [ ] Update `web/src/main.ts`:
  - [ ] Create Worker instance (`new Worker(...)`)
  - [ ] Add `onmessage` handler for Worker responses
  - [ ] Create Promise-based wrapper functions for each WASM operation
  - [ ] Handle Worker `onerror` events
  - [ ] Track WASM init timing for `app_loaded` event (used later in Plan 09)
- [ ] Configure Parcel to serve WASM binary correctly (may need `--dist-dir` or asset config)
- [ ] Verify WASM module loads in Worker without errors
- [ ] Verify a test conversion works end-to-end (main thread → Worker → WASM → Worker → main thread)
- [ ] Verify transferable objects are used (buffer is neutered after transfer)

## Key Details from PLANNING.md

**Message flow:**
1. Main thread posts `Uint8Array` + operation type to Worker
2. Worker calls WASM function
3. Worker posts result bytes back using transferable objects (zero-copy)

**Transferable objects:** `postMessage(result, [result.buffer])` — O(1) transfer regardless of size.

**WASM initialization:** Worker imports `init()` from wasm-pack generated JS glue, calls it once on startup.

**Performance principle:** Minimize JS↔WASM boundary crossings. Pass entire image buffer in one call, return result in one call.
