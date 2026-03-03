# Plan: Tier 2 Format Support (TIFF, ICO, TGA, QOI)

**Date:** 2026-03-01
**Status:** Done

## Goal

Add four new image formats — TIFF, ICO, TGA, and QOI — to the Rust WASM image converter by enabling the existing pure-Rust codecs in the `image` crate and wiring them through to the frontend.

## Approach

All four formats are already supported by the `image` crate behind cargo feature flags, so the implementation is additive: enable features, extend the `ImageFormat` enum and its match arms, update the frontend `FORMATS` array, and add MIME type entries. No architectural changes are needed — `detect_from_bytes()` already delegates to `image::guess_format()` which handles all four formats automatically.

## Critical

- Keep `default-features = false` on the `image` crate — never remove this, as it disables `rayon` which breaks WASM.
- All four new formats support both decode and encode, so `to_image_format()` must return `Ok(...)` for each — do **not** add `EncodeUnsupported` variants.
- The `match` arms in `formats.rs` must remain exhaustive — the compiler will catch missing variants if a new one is added.
- WASM boundary types must stay simple (`&[u8]`, `Vec<u8>`, `String`) — no changes needed to `lib.rs` or `convert.rs`.

## Steps

1. **Enable Cargo features** — add `"tiff"`, `"ico"`, `"tga"`, `"qoi"` to the `image` crate's features list in `crates/image-converter/Cargo.toml`.

2. **Extend `ImageFormat` enum** in `crates/image-converter/src/formats.rs`:
   - Add `Tiff`, `Ico`, `Tga`, `Qoi` variants to the enum.
   - Extend `from_image_format()` with the four new `image::ImageFormat` mappings.
   - Extend `from_name()` with `"tiff" | "tif"`, `"ico"`, `"tga"`, `"qoi"` arms.
   - Extend `to_image_format()` with `Ok(...)` mappings for all four.
   - Extend `as_str()` with the four lowercase string literals.
   - No changes needed to `detect_from_bytes()` — `image::guess_format()` already handles all four.

3. **Add tests** in the `#[cfg(test)]` block of `formats.rs` — helper functions encoding a minimal 1×1 image in each new format, then detection, `from_name`, alias (`"tif"`), and `to_image_format` tests mirroring the existing pattern.

4. **Update frontend format selector** — change the `FORMATS` constant in `web/src/components/FormatSelector.tsx` from `['png', 'jpeg', 'webp', 'gif', 'bmp']` to `['png', 'jpeg', 'webp', 'gif', 'bmp', 'qoi', 'ico', 'tiff', 'tga']`.

5. **Extend MIME type map** — add entries for the four new formats to the `MIME_TYPES` record in `web/src/hooks/useConverter.ts`:
   - `tiff: 'image/tiff'`
   - `ico: 'image/x-icon'`
   - `tga: 'image/x-tga'`
   - `qoi: 'image/qoi'`

   The extension derivation logic (`targetFormat === 'jpeg' ? 'jpg' : targetFormat`) already handles all four correctly since none are `"jpeg"`.

6. **Rebuild WASM and smoke-test** — run `wasm-pack build`, start dev server, and manually convert a PNG to each new format, verifying the downloaded file opens correctly.

## TODOs

- [x] Add `"tiff"`, `"ico"`, `"tga"`, `"qoi"` to `image` features in `Cargo.toml`
- [x] Add `Tiff`, `Ico`, `Tga`, `Qoi` variants to `ImageFormat` enum
- [x] Extend `from_image_format()` match arms
- [x] Extend `from_name()` match arms
- [x] Extend `to_image_format()` match arms
- [x] Extend `as_str()` match arms
- [x] Add format helper functions and tests in `formats.rs` `#[cfg(test)]` block
- [x] Update `FORMATS` array in `FormatSelector.tsx`
- [x] Add TIFF, ICO, TGA, QOI entries to `MIME_TYPES` in `useConverter.ts`
- [x] Run `cargo update image` to resolve stale lockfile blocking `tiff 0.10.3`
- [x] Rebuild WASM (`wasm-pack build crates/image-converter --target web --release`)
- [ ] Smoke-test each new format in the browser (requires human verification)

## Open Questions

- **TGA demand**: The roadmap recommends shipping TGA only if there is user demand (~15 KB gzipped cost). Decision: include it in this plan for completeness, but it can be removed from `Cargo.toml` and the enum if size becomes a concern after measurement.
- **ICO multi-resolution**: The `image` crate reads/writes only the first (largest) image in an ICO container. This is acceptable for now, but should be documented in a UI tooltip or FAQ.
- **TIFF large file warning**: TIFF outputs from high-resolution inputs can be very large (uncompressed). Consider adding a size warning in the UI for TIFF outputs exceeding a threshold.

## Implementation Discoveries

- **TIFF needs `cargo update image`**: Adding the `"tiff"` feature initially failed because the Cargo.lock was stale — it had `image v0.25.9` locked without `tiff 0.10.3` in the resolved dependency graph. Running `cargo update image` pulled in `tiff 0.10.3` and all four formats compiled successfully. No changes to the `image` version specifier were needed.

- **TGA has no magic bytes**: `image::guess_format()` cannot auto-detect TGA files because the TGA format has no fixed file header magic. TGA works correctly as an encode target (output format) but uploaded TGA files will be rejected with "Unrecognized format". The `detect_tga_unrecognized` test documents this behaviour explicitly. TGA remains in the frontend `FORMATS` list as a valid output target.

- **ICO requires minimum 16×16**: The `image` crate's ICO encoder rejected a 1×1 image in the test helper. Using a 16×16 image resolves this.

## Verification

| Check | Method | Who |
|-------|--------|-----|
| Rust unit tests pass for all new format detection | `cargo test --manifest-path crates/image-converter/Cargo.toml` | AI agent (automated) |
| `from_name("tif")` alias works | Unit test in `#[cfg(test)]` block | AI agent (automated) |
| `to_image_format()` returns `Ok` for all four new formats | Unit test | AI agent (automated) |
| `cargo clippy` passes with no warnings | `cargo clippy --manifest-path crates/image-converter/Cargo.toml` | AI agent (automated) |
| WASM build succeeds | `wasm-pack build crates/image-converter --target web --release` | AI agent (automated) |
| Each new format appears in the dropdown | Visual inspection in browser dev server | Human |
| PNG → TIFF download opens correctly in an image viewer | Manual smoke-test | Human |
| PNG → ICO download opens correctly | Manual smoke-test | Human |
| PNG → TGA download opens correctly | Manual smoke-test | Human |
| PNG → QOI download opens correctly | Manual smoke-test | Human |
| Downloaded files have the correct extension (`.tiff`, `.ico`, `.tga`, `.qoi`) | Manual smoke-test | Human |
