# Plan: WebP Output via Browser-Native OffscreenCanvas

**Date:** 2026-02-21
**Status:** Done

## Goal

Add WebP as a conversion output format using the browser's built-in libwebp encoder via `OffscreenCanvas.convertToBlob()` in the Web Worker, enabling lossy WebP output without any additional dependencies or changes to the Rust/WASM build target.

## Approach

The Rust `image` crate's WebP encoder (`image-webp` 0.2.4) is lossless-only. All lossy Rust options require C libwebp which fails to compile for `wasm32-unknown-unknown`. Instead:

1. Add a new WASM export `decode_to_rgba` that decodes any supported input image to raw RGBA8 pixel bytes.
2. In the Web Worker, intercept the `webp` target format before it reaches `convert_image`.
3. Feed the decoded pixels into an `OffscreenCanvas` and call `convertToBlob({ type: 'image/webp', quality: 0.85 })` — this uses the browser's native libwebp at full speed.
4. Return the blob bytes through the existing worker message protocol.

`formats.rs` and `Cargo.toml` need no changes. Browser support: Chrome 76+, Firefox 105+, Safari 16.4+.

## Steps

1. **`convert.rs`** — Add `pub fn decode_rgba(input: &[u8]) -> Result<Vec<u8>, ConvertError>` that calls `image::load_from_memory(input)?.into_rgba8().into_raw()`. Add unit tests covering all 5 input formats, pixel fidelity, and error paths (empty, random bytes, truncated).

2. **`lib.rs`** — Add `#[wasm_bindgen] pub fn decode_to_rgba(input: &[u8]) -> Result<Vec<u8>, JsError>` delegating to `convert::decode_rgba`. Follow existing export patterns (doc comment, `JsError` error message style).

3. **`worker.ts`** — Import `decode_to_rgba` from the WASM pkg. Add `async function encodeWebpViaCanvas(data: Uint8Array): Promise<Uint8Array>` that: checks `'OffscreenCanvas' in globalThis` (throws clear error if missing), calls `get_dimensions` + `decode_to_rgba`, creates `OffscreenCanvas`, puts `ImageData`, calls `convertToBlob({ type: 'image/webp', quality: 0.85 })`, returns result bytes. Make `handleConvertImage` async and branch on `targetFormat === 'webp'`.

4. **`ui.ts`** — Add `webp: 'image/webp'` to `MIME_TYPES`. Add `*->webp` entries to `TIMING_RATES` for all 5 source formats (base: 25–30ms, perMp: 30–40).

5. **`index.html`** — Add `<option value="webp">WebP</option>` after JPEG in the format dropdown. Update WebP format card description to reflect output support. Update FAQ `<details>` answer and JSON-LD structured data to include WebP as an output format.

6. **Build & verify** — Run `cargo test`, `cargo clippy`, `wasm-pack build`, `parcel build`. Manual smoke test all 5 input formats → WebP output. Verify graceful error on browsers without `OffscreenCanvas`.

## Todos

- [x] Add `decode_rgba` function to `convert.rs`
- [x] Add unit tests for `decode_rgba` in `convert.rs` (all 5 formats, pixel fidelity, error paths)
- [x] Add `decode_to_rgba` WASM export to `lib.rs`
- [x] Import `decode_to_rgba` in `worker.ts`
- [x] Add `encodeWebpViaCanvas` helper to `worker.ts`
- [x] Make `handleConvertImage` async and add `webp` branch in `worker.ts`
- [x] Add `webp: 'image/webp'` to `MIME_TYPES` in `ui.ts`
- [x] Add `*->webp` timing rate entries to `TIMING_RATES` in `ui.ts`
- [x] Add `<option value="webp">WebP</option>` to format dropdown in `index.html`
- [x] Update WebP format card description in `index.html`
- [x] Update FAQ answer and JSON-LD structured data in `index.html`
- [x] Run `cargo test` — all tests pass
- [x] Run `cargo clippy` — zero warnings
- [x] Run `wasm-pack build` — rebuild WASM with new export
- [x] Verify `decode_to_rgba` appears in generated `.d.ts` bindings
- [x] Run `parcel build` — frontend builds cleanly
- [ ] Manual smoke test: all 5 input formats → WebP output
- [ ] Manual smoke test: graceful error when `OffscreenCanvas` unavailable

## Open Questions

- Should a quality slider be exposed in the UI, or is 0.85 hardcoded for now? (Current plan: hardcode, add slider post-MVP.)
- Should `webp->webp` be allowed (decode + re-encode lossy)? (Current plan: yes, same path as all others — no special-casing.)
