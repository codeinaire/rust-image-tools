# Plan: Core Conversion Logic & Dimension Reading

**Date:** 2026-02-14
**Status:** Done
**PR Scope:** Medium — core image processing functions
**Depends On:** Plan 01 (crate scaffold + format detection)

## Goal

Implement the `convert_image()` and `get_dimensions()` functions — the core image processing pipeline that decodes an input image and re-encodes it to a target format, plus lightweight dimension reading from headers.

## Approach

The conversion pipeline is: raw bytes → `image::load_from_memory()` → `DynamicImage` → encode to target format via `image::write_to()`. Dimension reading uses `image::io::Reader` to extract width/height from headers without full decoding. Both functions are exported via `wasm_bindgen` in `lib.rs`, with internal logic in `convert.rs`.

Memory note: drop the input buffer explicitly after decoding to free memory before encoding (important for WASM's constrained linear memory).

## Steps

1. Create `src/convert.rs` with:
   - Internal `convert()` function: decode input bytes → encode to target format
   - Internal `dimensions()` function: read width/height from image headers
   - Use format mapping from `formats.rs` to resolve target format strings
2. Wire up `#[wasm_bindgen]` exports in `lib.rs`:
   - `convert_image(input: &[u8], target_format: &str) -> Result<Vec<u8>, JsError>`
   - `get_dimensions(input: &[u8]) -> Result<JsValue, JsError>`
3. Add meaningful error messages via `map_err()` for decode failures, unsupported formats, and encode failures
4. Add basic unit tests for conversion and dimension reading
5. Verify `cargo fmt`, `cargo clippy`, and `cargo test` all pass

## Todo

- [x] Create `src/convert.rs` with internal conversion logic
- [x] Implement decode → encode pipeline with explicit memory management (`drop(input)` after decode)
- [x] Implement dimension reading from image headers (without full decode)
- [x] Add `convert_image()` wasm_bindgen export to `lib.rs`
- [x] Add `get_dimensions()` wasm_bindgen export to `lib.rs` (returns `{ width, height }` via `JsValue`)
- [x] Add `serde` and `serde-wasm-bindgen` dependencies if needed for `JsValue` serialization
- [x] Handle unsupported target format with clear error message
- [x] Add doc comments to all public functions
- [x] Write unit tests: PNG→JPEG, JPEG→PNG basic round-trips
- [x] Write unit tests: dimension reading for each format
- [x] Write unit tests: error on unsupported output format (e.g., `"avif"`, `"notaformat"`)
- [x] Run `cargo fmt`, `cargo clippy`, `cargo test`
- [x] Verify `wasm-pack build` still compiles

## Key Details from PLANNING.md

**WASM API:**
```rust
#[wasm_bindgen]
pub fn convert_image(input: &[u8], target_format: &str) -> Result<Vec<u8>, JsError> { ... }

#[wasm_bindgen]
pub fn get_dimensions(input: &[u8]) -> Result<JsValue, JsError> {
    // Returns { width: u32, height: u32 }
}
```

**Output formats (encode targets):** PNG, JPEG, GIF, BMP
**Input formats (decode sources):** PNG, JPEG, WebP, GIF, BMP
**WebP is decode-only** — not available as a target format in V1.
