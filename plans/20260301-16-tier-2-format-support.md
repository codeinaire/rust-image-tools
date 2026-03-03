# Plan: Tier 2 Format Support (TIFF, ICO, TGA, QOI)

**Date:** 2026-03-01
**Status:** Completed

## Goal

Add four new image formats — TIFF, ICO, TGA, and QOI — to the Rust WASM image converter by enabling the existing pure-Rust codecs in the `image` crate and wiring them through to the frontend. Backed by a full Playwright E2E test suite covering format conversions, UI validation guards, and all tier-2 formats.

## Approach

All four formats are already supported by the `image` crate behind cargo feature flags, so the implementation is additive: enable features, extend the `ImageFormat` enum and its match arms, update the frontend `FORMATS` array, and add MIME type entries. No architectural changes are needed — `detect_from_bytes()` already delegates to `image::guess_format()` which handles all four formats automatically.

Frontend format selection uses two tiers: `TOP_FORMATS` (PNG, JPEG, WebP, GIF) shown as direct buttons, and `MORE_FORMATS` (BMP, QOI, ICO, TIFF, TGA) accessible via a `···` dropdown portal.

Three Playwright test files run against a live Astro dev server (`http://localhost:4321`). Worker-level tests call `window.__converter` directly (bypasses UI, faster, avoids selector fragility). E2E tests drive the full UI using stable `id` and `data-format` attributes added to DropZone.

A shared `selectFormat(page, fmt)` helper handles both top-format buttons (direct click) and the `···` dropdown (open → wait for portal → click → confirm label update).

## Critical

- Keep `default-features = false` on the `image` crate — never remove this, as it disables `rayon` which breaks WASM.
- All four new formats support both decode and encode, so `to_image_format()` must return `Ok(...)` for each — do **not** add `EncodeUnsupported` variants.
- The `match` arms in `formats.rs` must remain exhaustive — the compiler will catch missing variants if a new one is added.
- WASM boundary types must stay simple (`&[u8]`, `Vec<u8>`, `String`) — no changes needed to `lib.rs` or `convert.rs`.
- All test IDs (`#source-info`, `#source-details`, `#convert-btn`, `#result-area`, `#result-details`, `#download-link`) must remain on their respective DropZone elements.
- `data-format={fmt}` attributes must stay on all format buttons and MORE dropdown items.
- `id="more-formats-btn"` must stay on the `···` button.
- The `download-link` `<a>` must keep `data-output-size={result.outputSize}`.
- `playwright.config.ts` `testDir` must remain `./tests/e2e`.

## Steps

### Rust / WASM

1. **Enable Cargo features** — add `"tiff"`, `"ico"`, `"tga"`, `"qoi"` to the `image` crate's features list in `crates/image-converter/Cargo.toml`.
2. **Extend `ImageFormat` enum** in `crates/image-converter/src/formats.rs`:
   - Add `Tiff`, `Ico`, `Tga`, `Qoi` variants to the enum.
   - Extend `from_image_format()`, `from_name()`, `to_image_format()`, `as_str()` match arms.
3. **Add Rust unit tests** — helper functions encoding a minimal image in each new format, then detection, `from_name`, alias (`"tif"`), and `to_image_format` tests.
4. **Rebuild WASM** — `wasm-pack build crates/image-converter --target web --release`.

### Frontend

5. **Introduce `ValidFormat` enum** in `web/src/formats.ts` — string enum (`Png = 'png'`, etc.) used end-to-end so format strings are type-checked at the TS/WASM boundary.
6. **Update `MIME_TYPES`** in `useConverter.ts` — add TIFF, ICO, TGA, QOI entries; key by `ValidFormat`.
7. **Update `TOP_FORMATS` / `MORE_FORMATS`** in `DropZone.tsx` to use `ValidFormat` enum values.
8. **Add stable test IDs** to `DropZone.tsx`:
   - `id="source-info"` + `id="source-details"` on the file info paragraph
   - `data-format={fmt}` on each format button and MORE portal item
   - `id="more-formats-btn"` on the `···` button
   - `id="convert-btn"` on the execute button
   - `id="result-area"` on result stats container; `id="result-details"` hidden span
   - `id="download-link"` + `data-output-size` on the download `<a>`

### Tests

9. Fix `playwright.config.ts` — change `testDir` from `./tests/integration` to `./tests/e2e`.
10. Create `tests/e2e/formats.spec.ts` — worker-level tier-2 format tests.
11. Update `tests/e2e/conversion.spec.ts` — replace `#format-select` + `selectOption` with `selectFormat()` helper.
12. Update `tests/e2e/validation.spec.ts` — same helper; fix `toBeDisabled()` → `not.toBeAttached()` for rejection cases.
13. Fix BMP dropdown race condition — `waitFor({ state: 'visible' })` on portal item + `toContainText` guard before clicking convert.

## TODOs

- [x] Add `"tiff"`, `"ico"`, `"tga"`, `"qoi"` to `image` features in `Cargo.toml`
- [x] Add `Tiff`, `Ico`, `Tga`, `Qoi` variants to `ImageFormat` enum
- [x] Extend `from_image_format()`, `from_name()`, `to_image_format()`, `as_str()` match arms
- [x] Add format helper functions and tests in `formats.rs` `#[cfg(test)]` block
- [x] Run `cargo update image` to resolve stale lockfile blocking `tiff 0.10.3`
- [x] Rebuild WASM (`wasm-pack build crates/image-converter --target web --release`)
- [x] Introduce `ValidFormat` string enum in `web/src/formats.ts`
- [x] Key `MIME_TYPES` by `ValidFormat`; add TIFF, ICO, TGA, QOI entries
- [x] Update `TOP_FORMATS` / `MORE_FORMATS` in `DropZone.tsx` to use `ValidFormat`
- [x] Add stable test IDs to `DropZone.tsx`
- [x] Fix `testDir` in `playwright.config.ts`
- [x] Create `formats.spec.ts` for tier-2 formats
- [x] Update `conversion.spec.ts` to use `selectFormat()` helper
- [x] Update `validation.spec.ts` to use `selectFormat()` helper + fix rejection assertions
- [x] Fix BMP dropdown race condition in `selectFormat`
- [x] Fix ICO oversized test: replace `test-huge.png` (OOM risk) with canvas-generated 300×300 PNG
- [x] Smoke-test each new format in the browser (human verification)

## Open Questions

- **TGA demand**: Roadmap recommends shipping TGA only if there is user demand (~15 KB gzipped cost). Included for completeness; can be removed from `Cargo.toml` and the enum if size becomes a concern.
- **ICO multi-resolution**: The `image` crate reads/writes only the first (largest) image in an ICO container. Consider documenting this in a UI tooltip or FAQ.
- **TIFF large file warning**: TIFF outputs from high-resolution inputs can be very large (uncompressed). Consider adding a size warning for TIFF outputs exceeding a threshold.

## Implementation Discoveries

- **TIFF needs `cargo update image`**: Adding the `"tiff"` feature initially failed because the Cargo.lock was stale — it had `image v0.25.9` locked without `tiff 0.10.3` in the resolved dependency graph. Running `cargo update image` pulled in `tiff 0.10.3` and all four formats compiled successfully.
- **TGA has no magic bytes**: `image::guess_format()` cannot auto-detect TGA files because the TGA format has no fixed file header magic. TGA works correctly as an encode target but uploaded TGA files will be rejected with "Unrecognized format". The `detect_tga_unrecognized` test documents this explicitly.
- **ICO requires minimum 16×16**: The `image` crate's ICO encoder rejected a 1×1 image in the test helper. Using 16×16 resolves this. The ICO format also has a hard 256×256 maximum — attempting to encode a larger image produces an error.
- **`playwright.config.ts` `testDir` mismatch**: Was set to `./tests/integration` but no such directory existed — all tests were silently skipped before this fix.
- **DropZone refactor left props unwired**: After the DropZone absorbed format selection, `ImageConverter` was only passing `onFile` and `fileInfo`, leaving `targetFormat`, `onFormatChange`, `onConvert`, etc. all `undefined`. Format buttons appeared to select nothing.
- **Validation rejection tests**: After a file is rejected (too large or too many MP), `fileInfo` is set to `null` so `#convert-btn` is never rendered. `toBeDisabled()` threw on a missing element; correct assertion is `not.toBeAttached()`.
- **BMP dropdown race condition**: BMP is a MORE_FORMAT requiring the `···` portal. Playwright clicked the item but the `onConvert` closure in `ImageConverter` still captured the old `targetFormat` before Preact re-rendered. Fix: wait for `#more-formats-btn` label to show `BMP` before clicking convert.
- **ICO oversized test OOM risk**: Originally loaded `test-huge.png` (10001×10001 = 100 MP). At the worker level this bypasses the MP guard and tries to fully decode 100 MP into RGBA. Replaced with an in-page canvas 300×300 PNG.
- **TIFF endianness**: TIFF can be either little-endian (`II 2A 00`) or big-endian (`MM 00 2A`) — the magic byte test accepts both.

## Verification

### Rust unit tests (automated)

| Check                                                     | Command                                                          |
| --------------------------------------------------------- | ---------------------------------------------------------------- |
| All format detection tests pass                           | `cargo test --manifest-path crates/image-converter/Cargo.toml`   |
| `from_name("tif")` alias works                            | Unit test in `#[cfg(test)]` block                                |
| `to_image_format()` returns `Ok` for all four new formats | Unit test                                                        |
| `cargo clippy` passes with no warnings                    | `cargo clippy --manifest-path crates/image-converter/Cargo.toml` |
| WASM build succeeds                                       | `wasm-pack build crates/image-converter --target web --release`  |

### `tests/e2e/formats.spec.ts` — Tier-2 format conversions (worker-level, automated)

| Test                  | Verifies                                                  |
| --------------------- | --------------------------------------------------------- |
| PNG → WebP            | Magic bytes `RIFF…WEBP` at offsets 0 and 8                |
| PNG → TIFF            | Magic bytes LE (`II 2A 00`) or BE (`MM 00 2A`)            |
| PNG → ICO             | Magic bytes `00 00 01 00`                                 |
| ICO oversized error   | canvas 300×300 → error matches `/width\|256\|malformed/i` |
| PNG → TGA             | Non-zero output size (no magic bytes in TGA spec)         |
| PNG → QOI             | Magic bytes `qoif` (`71 6F 69 66`)                        |
| All tier-2 round-trip | WebP, TIFF, TGA, QOI, BMP all produce non-zero output     |

### `tests/e2e/conversion.spec.ts` — End-to-end conversion (full UI, automated)

| Test                             | Verifies                                                     |
| -------------------------------- | ------------------------------------------------------------ |
| File select → convert → download | Blob URL valid, correct extension, PNG magic bytes confirmed |
| Format auto-detection (JPEG)     | `#source-details` text contains `JPEG`                       |
| Format auto-detection (PNG)      | `#source-details` text contains `PNG`                        |
| Before/after metadata            | `#result-details` contains `→` and `ms`/`s`                  |
| Corrupted file error             | `#error-display` shown with non-empty message                |
| Multiple format conversions      | JPEG, GIF, BMP all produce correct magic bytes via UI flow   |

### `tests/e2e/validation.spec.ts` — Validation guards (full UI, automated)

| Test                      | Verifies                                                             |
| ------------------------- | -------------------------------------------------------------------- |
| File > 200 MB rejected    | Error shown, `#convert-btn` not in DOM                               |
| Image > 100 MP rejected   | Error shown mentioning MP, `#convert-btn` not in DOM                 |
| No main-thread blocking   | RAF frame deltas all < 1000 ms during conversion                     |
| Blob URL revoked on reset | `URL.revokeObjectURL` called with previous blob URL on new file load |

### Manual smoke-test (human)

| Check                                                                      |
| -------------------------------------------------------------------------- |
| Each new format appears in the `···` dropdown                              |
| PNG → TIFF download opens correctly in an image viewer                     |
| PNG → ICO download opens correctly                                         |
| PNG → TGA download opens correctly                                         |
| PNG → QOI download opens correctly                                         |
| Downloaded files have correct extensions (`.tiff`, `.ico`, `.tga`, `.qoi`) |
