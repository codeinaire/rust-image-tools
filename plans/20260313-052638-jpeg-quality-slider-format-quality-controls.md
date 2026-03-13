# Plan: JPEG Quality Slider + Format Quality Controls

**Date:** 2026-03-13
**Status:** Complete
**Research:** research/20260312-112252-jpeg-quality-slider-format-quality-controls.md

## Goal

Add user-configurable output quality controls for lossy formats (JPEG, WebP) and PNG compression level, passing quality through the full stack: Rust encoder, WASM export, Worker protocol, and a conditionally-visible slider UI.

## Approach

Add an `Option<u8>` quality parameter to the existing `convert_image()` WASM export (research Option A). The frontend presents a single unified percentage slider (0-100%) with the label "QUALITY" for all supported formats. Behind the scenes, each format maps the percentage to its native range: JPEG uses 1-100 directly, WebP divides by 100 for the Canvas API's 0.0-1.0 float, and PNG maps the percentage to compression levels 1-9. The Rust side handles JPEG via `JpegEncoder::new_with_quality()` and PNG via `PngEncoder::new_with_quality()` with a percentage-to-compression-level mapping function. The quality parameter is ignored for formats without encoder-level quality control (GIF, BMP, TIFF, ICO, TGA, QOI). A single `quality` state (default 80) persists across format switches.

## Critical

- Default JPEG quality must be 80 in Rust (`unwrap_or(80)`) -- the frontend also defaults to 80, but the Rust side must not depend on the frontend always sending a value.
- Validate quality range (1-100) in both Rust (`lib.rs`) and TypeScript (clamp in slider component) -- defense in depth.
- Use `onInput` (not `onChange`) on the range input in Preact -- `onChange` only fires on release, not during drag.
- Use `write_with_encoder()` for JPEG and PNG encoding, not `write_to()` -- `write_to()` does not accept encoder options.
- Use the `image::codecs` module path (`image::codecs::jpeg::JpegEncoder`, `image::codecs::png::PngEncoder`) not the deprecated top-level path.
- PNG compression level mapping: the Rust side receives the same 1-100 value and maps it internally to `CompressionType::Level(1-9)`. Higher percentage = more compression = smaller file. The mapping formula is `1 + (quality - 1) * 8 / 99` (linear interpolation from 1-100 to 1-9).
- WebP quality conversion: divide integer (1-100) by 100 to get the 0.0-1.0 float for Canvas API. This happens in the Worker, not in Rust.
- Make sure when the quality value is passed into rust it's validated to be in the correct range for the format that it's being used for.

## Steps

### Rust: Core Logic

- [x] In `crates/image-converter/src/convert.rs`, add `quality: Option<u8>` parameter to the `convert()` function signature, changing it from `convert(input: Vec<u8>, target: ImageFormat)` to `convert(input: Vec<u8>, target: ImageFormat, quality: Option<u8>)`.
- [x] In `crates/image-converter/src/convert.rs`, add `use image::codecs::jpeg::JpegEncoder;` and `use image::codecs::png::{PngEncoder, CompressionType, FilterType};` imports at the top (`use std::io::Cursor;` is already present).
- [x] In `crates/image-converter/src/convert.rs`, replace the single `write_to()` call with a `match target` block: for `ImageFormat::Jpeg`, construct `JpegEncoder::new_with_quality(Cursor::new(&mut output_buf), quality.unwrap_or(80))` and call `decoded.write_with_encoder(encoder)`; for `ImageFormat::Png`, construct `PngEncoder::new_with_quality(Cursor::new(&mut output_buf), map_png_quality(quality), FilterType::Adaptive)` and call `decoded.write_with_encoder(encoder)`; for all other formats, use the existing `write_to()` path unchanged. The `to_image_format()` call should move inside the default match arm (not needed for JPEG/PNG since we use custom encoders).
- [x] In `crates/image-converter/src/convert.rs`, add a private helper function `fn map_png_quality(quality: Option<u8>) -> CompressionType` that maps the unified 1-100 percentage to PNG compression levels: `None` maps to `CompressionType::Default`; `Some(q)` maps to `CompressionType::Level(1 + (q - 1) * 8 / 99)` (linear interpolation from 1-100 to 1-9, using integer arithmetic). This means quality 1 = compression level 1 (fastest, largest), quality 100 = compression level 9 (slowest, smallest).
- [x] In `crates/image-converter/src/convert.rs`, add a `QualityError` variant to `ConvertError`: `InvalidQuality(u8)` for values outside the valid range. Add display: `"Quality must be between 1 and 100, got {q}"`.
- [x] In `crates/image-converter/src/convert.rs`, update the `assert_conversion` test helper to pass `None` as quality: `convert(input.to_vec(), target, None)`. Update all existing test calls to `convert()` to include the third `None` argument (there are ~20+ calls in the test module).

### Rust: WASM Export

- [x] In `crates/image-converter/src/lib.rs`, update the `convert_image()` function signature to add `quality: Option<u8>` as the third parameter. Add validation: if `quality` is `Some(q)` and `q == 0 || q > 100`, return `Err(JsError::new("Quality must be between 1 and 100"))`. Pass `quality` through to `convert::convert()`.

### TypeScript: Types

- [x] In `web/src/types/interfaces.ts`, add `quality?: number` field to the `ConvertImageRequest` interface (after `targetFormat`).

### TypeScript: Worker

- [x] In `web/src/worker.ts`, update the `handleConvertImage()` function signature to accept `quality?: number` as the fourth parameter.
- [x] In `web/src/worker.ts`, update the WebP canvas path: replace the hardcoded `quality: 0.85` in `encodeWebpViaCanvas()` with a parameter. In `handleConvertImage()`, for the WebP branch, compute `const canvasQuality = quality !== undefined ? quality / 100 : 0.85` and pass it to `encodeWebpViaCanvas()`. Update `encodeWebpViaCanvas` signature to accept `quality: number` and use it in `canvas.convertToBlob({ type: 'image/webp', quality })`.
- [x] In `web/src/worker.ts`, update the WASM branch: pass `quality` as the third argument to `convert_image(data, targetFormat, quality)`. When quality is `undefined`, wasm-bindgen will receive `None` on the Rust side.
- [x] In `web/src/worker.ts`, update the `onmessage` handler's `ConvertImage` case to pass `request.quality` to `handleConvertImage()`.

### TypeScript: Image Converter Library

- [x] In `web/src/lib/image-converter.ts`, update `convertImage()` and `convertImageTimed()` to accept an optional `quality?: number` parameter. Include `quality` in the `WorkerRequest` object sent via `sendRequest()`.

### TypeScript: Quality Slider Component

- [x] Create `web/src/components/DropZone/QualitySlider.tsx`. The component accepts props: `quality: number`, `onQualityChange: (quality: number) => void`, `targetFormat: ValidFormat`. It renders a labeled native `<input type="range">` with `min={1}`, `max={100}`, and uses `onInput` for live updates. The label shows "QUALITY: {value}%" for all supported formats. The slider is only rendered when the target format is in `FORMATS_WITH_QUALITY` (JPEG, WebP, PNG). Return `null` for non-applicable formats. Use the cyberpunk styling conventions (monospace font, cyan/yellow colors, letterSpacing) matching the existing `FormatSelector` component.
- [x] In the `QualitySlider` component, add proper ARIA attributes: `aria-label="Output quality"`, `aria-valuemin={1}`, `aria-valuemax={100}`, `aria-valuenow={quality}`. Give the input a unique `id="quality-slider"` and associate the label via `for="quality-slider"`.

### TypeScript: Hook + State

- [x] In `web/src/hooks/useConverter.ts`, add `quality` state: `const [quality, setQuality] = useState<number>(80)`. This single piece of state persists across format switches (not reset when target format changes). The same 1-100 value is used regardless of which format is selected.
- [x] In `web/src/hooks/useConverter.ts`, update `handleConvert()` to pass quality to `converter.convertImage()`. Add a helper `getQualityForFormat(targetFormat: ValidFormat, quality: number): number | undefined` that returns the raw 1-100 value for JPEG, WebP, and PNG (the worker and Rust handle format-specific mapping), and `undefined` for formats without quality support.
- [x] In `web/src/hooks/useConverter.ts`, export `quality` and `setQuality` from the hook return value.
- [x] In `web/src/hooks/useConverter.ts`, add a constant `FORMATS_WITH_QUALITY` as a `ReadonlySet<ValidFormat>` containing `ValidFormat.Jpeg`, `ValidFormat.WebP`, and `ValidFormat.Png`. Export it for use by the slider component.

### TypeScript: Wire Up UI

- [x] In `web/src/components/DropZone/index.tsx`, import `QualitySlider` and render it between the file info area and the bottom controls row (above the progress bar). Pass `quality`, `onQualityChange`, and `targetFormat` as props. Only render it when `fileInfo` is present and `controlsVisible` is true.
- [x] In `web/src/components/ImageConverter.tsx`, destructure `quality` and `setQuality` from `useConverter()`. Pass them down through `DropZone` props. Add `quality` and `onQualityChange` to the `DropZone` Props interface.

### Analytics

- [x] In `web/src/analytics.ts`, update `trackConversionStarted` props type to include `quality?: number`. Update `trackConversionCompleted` props type to include `quality?: number`.
- [x] In `web/src/hooks/useConverter.ts`, include `quality` in the `trackConversionStarted()` and `trackConversionCompleted()` calls (only when quality is defined, i.e., for formats that support it).

### Tests: Rust

- [x] In `crates/image-converter/src/convert.rs` `#[cfg(test)]` module, add test `jpeg_quality_boundaries`: convert a patterned PNG to JPEG at quality 1, 50, 80, and 100. Assert that quality 1 output is smaller than quality 100 output. Assert all outputs are valid decodable JPEG images.
- [x] Add test `jpeg_default_quality_matches_80`: convert the same image with `quality: None` and `quality: Some(80)`. Assert the outputs are byte-identical.
- [x] Add test `png_quality_mapping`: convert a patterned PNG with quality 1 (maps to compression level 1) and quality 100 (maps to compression level 9). Assert quality 100 output is smaller than or equal to quality 1 output (higher quality % = more compression for PNG). Assert both are valid PNG images.
- [x] Add test `png_default_compression`: convert with `quality: None` and verify the output is a valid PNG (uses `CompressionType::Default`).
- [x] Add test `quality_ignored_for_other_formats`: convert a PNG to BMP with `quality: Some(50)`. Assert it succeeds and produces the same output as `quality: None`.
- [x] Add test `quality_zero_returns_error`: call `convert()` with `quality: Some(0)`. Assert it returns an error. (Note: this validation happens in `lib.rs`, so test at the WASM export level or add validation in `convert()` too.)
- [x] Add test `quality_101_returns_error`: call with `quality: Some(101)`. Assert error.
- [x] Add test `map_png_quality_boundaries`: unit test the `map_png_quality()` helper directly. Assert that quality 1 maps to `CompressionType::Level(1)`, quality 100 maps to `CompressionType::Level(9)`, quality 50 maps to a level between 1 and 9, and `None` maps to `CompressionType::Default`.

### Tests: TypeScript Unit

- [x] Create `web/tests/unit/quality-slider.test.ts`. Test that `QualitySlider` renders for JPEG/WebP/PNG and returns null for BMP/GIF. Test that the slider always has max=100 regardless of format. Test that `onQualityChange` fires with the correct value on input events.
- [x] Create `web/tests/unit/quality-format-helper.test.ts`. Test the `getQualityForFormat()` helper: returns the raw 1-100 value for JPEG/WebP/PNG, returns `undefined` for GIF/BMP/TIFF/ICO/TGA/QOI.

### Tests: E2E

- [x] Create `web/tests/e2e/quality.spec.ts`. Test: upload an image, select JPEG as target, verify quality slider is visible with default value 80. Change quality to 50, click convert, verify conversion succeeds. Switch format to PNG, verify slider is still visible with the same value of 50 and the same "QUALITY" label. Switch format to BMP, verify slider is hidden. Switch back to JPEG, verify slider reappears with persisted value of 50.

## Security

**Known vulnerabilities:** No known vulnerabilities identified as of 2026-03-12 for the `image` crate or `wasm-bindgen` at their current versions.

**Architectural risks:**

- Quality parameter injection: The `quality` value crosses the Worker postMessage boundary and then the WASM boundary. A malicious script could pass values outside 1-100 (e.g., 0 or 255). Mitigation: validate in Rust (`lib.rs`) that quality is within 1-100 before passing to the encoder. The `u8` type already prevents negative values. Clamp in the TypeScript slider component as a first line of defense.
- Trust boundary: User input (slider) -> main thread -> Worker (postMessage) -> WASM. Validation is mandatory at the WASM entry point (`lib.rs`). The quality parameter is not security-sensitive (worst case: a slightly different output file), but validation ensures correctness and prevents potential encoder panics on out-of-range values.

## Open Questions

1. **Should quality be exposed for WebP too?** (Resolved: Yes, per user decision. Pass slider value / 100 to Canvas API `convertToBlob({ quality })`)
2. **Should PNG compression level be exposed?** (Resolved: Yes, per user decision. Unified 1-100 slider; Rust maps percentage to compression levels 1-9 internally.)
3. **Should quality persist when switching formats?** (Resolved: Yes, per user decision. Single quality state persists across all format switches.)
4. **Unified slider vs. per-format ranges?** (Resolved: Single unified 0-100% slider with "QUALITY" label for all formats. Mapping to format-specific ranges happens behind the scenes -- JPEG uses 1-100 directly, WebP divides by 100 in the Worker, PNG maps to 1-9 compression levels in Rust.)

## Implementation Discoveries

- `CompressionType::Level(u8)` in the `image` crate v0.25 accepts a `u8`, not `u32`. The linear interpolation formula produces a `u32` which needs to be cast to `u8`. Used `#[allow(clippy::as_conversions)]` since the result is always 1-9 and safe.
- `exactOptionalPropertyTypes` in tsconfig means you cannot assign `number | undefined` to a property typed as `quality?: number`. Fixed by using spread syntax `...(value !== undefined ? { quality: value } : {})` instead of direct assignment.
- wasm-bindgen generates `Option<u8>` as `quality?: number | null` in TypeScript (not `quality?: number`). This is compatible with passing `undefined` from the JS side.
- The FormatSelector dropdown (more-formats) uses `createPortal` with `position: fixed` and `bottom` positioning, which can place items outside the viewport in headless Chromium. E2E tests need to use `page.evaluate(() => element.click())` instead of Playwright's `.click()` for these items.
- The plan mentioned validation in `convert()` with `quality: Some(0)` test, noting it "happens in `lib.rs`". Added validation in both `convert()` (returns `ConvertError::InvalidQuality`) and `lib.rs` (returns `JsError`) for defense in depth.

## Verification

- [x] JPEG quality 1 produces smaller output than quality 100 -- Rust unit -- `cargo test --manifest-path crates/image-converter/Cargo.toml jpeg_quality` -- Automatic
- [x] JPEG default quality (None) matches quality 80 -- Rust unit -- `cargo test --manifest-path crates/image-converter/Cargo.toml jpeg_default` -- Automatic
- [x] PNG quality 100 (max compression) produces smaller-or-equal output vs quality 1 (min compression) -- Rust unit -- `cargo test --manifest-path crates/image-converter/Cargo.toml png_quality` -- Automatic
- [x] PNG quality percentage maps correctly to compression levels 1-9 -- Rust unit -- `cargo test --manifest-path crates/image-converter/Cargo.toml map_png_quality` -- Automatic
- [x] Quality 0 and 101 return errors -- Rust unit -- `cargo test --manifest-path crates/image-converter/Cargo.toml quality_zero quality_101` -- Automatic
- [x] Quality ignored for non-lossy/non-PNG formats -- Rust unit -- `cargo test --manifest-path crates/image-converter/Cargo.toml quality_ignored` -- Automatic
- [x] All existing Rust tests still pass with new quality parameter -- Rust unit -- `cargo test --manifest-path crates/image-converter/Cargo.toml` -- Automatic
- [x] QualitySlider renders for JPEG/WebP/PNG, hidden for others -- TS unit -- `cd web && npm run test` -- Automatic
- [x] Slider always has max=100 regardless of format -- TS unit -- `cd web && npm run test` -- Automatic
- [x] Quality helper returns correct values per format -- TS unit -- `cd web && npm run test` -- Automatic
- [x] Slider visible with correct defaults and persists across format switches -- E2E -- `cd web && npm run test:e2e` -- Automatic
- [x] Rust lints pass -- lint -- `cargo clippy --manifest-path crates/image-converter/Cargo.toml -- -D warnings` -- Automatic
- [x] TypeScript checks pass -- lint -- `cd web && npm run check:all` -- Automatic
- [x] WASM builds successfully -- build -- `wasm-pack build crates/image-converter --target web --release` -- Automatic
- [ ] Visual inspection: slider styling matches cyberpunk theme -- Manual -- Open dev server, upload image, verify slider appearance -- Manual
