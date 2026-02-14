# Plan: Rust WASM Crate Scaffold & Format Detection

**Date:** 2026-02-14
**Status:** Draft
**PR Scope:** Small — foundational crate setup + format detection logic
**Depends On:** None

## Goal

Set up the `crates/image-converter` Rust WASM library crate with the correct Cargo.toml configuration, module structure, and a working `detect_format()` function exported via `wasm_bindgen`.

## Approach

Create the crate skeleton following the project structure defined in PLANNING.md. The `image` crate must use `default-features = false` to avoid pulling in `rayon` (which breaks WASM). The format detection function reads magic bytes/headers to identify image formats without fully decoding. All `#[wasm_bindgen]` exports live in `lib.rs`; internal logic lives in submodules.

## Steps

1. Create `crates/image-converter/Cargo.toml` with:
   - `crate-type = ["cdylib", "rlib"]`
   - `wasm-bindgen = "0.2"`
   - `image = { version = "0.25", default-features = false, features = ["png", "jpeg", "gif", "webp", "bmp"] }`
   - Release profile: `opt-level = "s"`, `lto = true`, `strip = true`
   - Workspace lints inheritance
2. Create `src/lib.rs` as thin entry point with `#[wasm_bindgen]` export for `detect_format()`
3. Create `src/formats.rs` with:
   - Format enum/type mapping (PNG, JPEG, WebP, GIF, BMP)
   - Detection logic using `image::guess_format()` or magic byte inspection
   - String conversion for format names (to/from)
4. Add unit tests for format detection in `formats.rs` (`#[cfg(test)]` module)
5. Verify `cargo fmt`, `cargo clippy`, and `cargo test` all pass

## Todo

- [ ] Create `crates/image-converter/` directory structure
- [ ] Write `crates/image-converter/Cargo.toml` with correct dependencies and features
- [ ] Create `src/formats.rs` — format enum, `detect_from_bytes()`, string mapping
- [ ] Create `src/lib.rs` — `#[wasm_bindgen] pub fn detect_format()` export
- [ ] Add doc comments to all public types and functions
- [ ] Write unit tests: detect PNG, JPEG, WebP, GIF, BMP from valid bytes
- [ ] Write unit tests: error on unrecognized/corrupted bytes
- [ ] Run `cargo fmt` and fix formatting
- [ ] Run `cargo clippy` and fix all warnings
- [ ] Run `cargo test` and verify all tests pass
- [ ] Verify `wasm-pack build` compiles successfully

## Open Questions

- Should `detect_format()` return a string (e.g., `"png"`) or a structured type via `JsValue`? PLANNING.md shows it returning `String`, which is simplest for the JS boundary.

## Key Details from PLANNING.md

**Supported formats (Tier 1):**
| Format | Decode | Encode |
|--------|--------|--------|
| PNG    | Yes    | Yes    |
| JPEG   | Yes    | Yes    |
| WebP   | Yes    | No (decode only for V1) |
| GIF    | Yes    | Yes    |
| BMP    | Yes    | Yes    |

**WASM API for this plan:**
```rust
#[wasm_bindgen]
pub fn detect_format(input: &[u8]) -> Result<String, JsError> { ... }
```
