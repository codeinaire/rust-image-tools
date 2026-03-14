# JPEG Quality Slider + Format Quality Controls - Research

**Researched:** 2026-03-12
**Domain:** Image encoding quality parameters, WASM boundary design, UI range slider patterns
**Confidence:** HIGH

## Summary

Adding quality controls to this image converter is well-supported by the existing stack. The `image` crate (v0.25) provides `JpegEncoder::new_with_quality(writer, quality)` with a 1-100 range, and `DynamicImage::write_with_encoder()` accepts any `ImageEncoder` implementor -- so the current `write_to()` call in `convert.rs` just needs to be replaced with a custom encoder path for JPEG. PNG compression is controlled via `CompressionType` (not a quality number), and WebP encoding through the `image` crate is lossless-only (the existing canvas-based WebP path already has its own quality parameter via `canvas.convertToBlob({ quality: 0.85 })`).

On the WASM boundary, `wasm-bindgen` natively supports `Option<u8>` parameters, generating `number | undefined` in TypeScript. This is the simplest approach and avoids adding a new WASM export or options struct. The existing `convert_image(input, target_format)` signature can become `convert_image(input, target_format, quality)` where quality is `Option<u8>`.

The frontend work is straightforward: a native `<input type="range">` element with Preact state, conditionally shown when the target format is JPEG (or future lossy formats). No slider library is needed -- native HTML range inputs with proper ARIA attributes cover all accessibility requirements.

**Primary recommendation:** Add `Option<u8>` quality parameter to the existing `convert_image()` WASM export; use `JpegEncoder::new_with_quality()` with `write_with_encoder()` on the Rust side; add a native range slider component on the frontend shown only for JPEG.

## Standard Stack

### Core

| Library | Version | Purpose | License | Maintained? | Why Standard |
| ------- | ------- | ------- | ------- | ----------- | ------------ |
| image | 0.25 | Image decoding/encoding with quality control | MIT/Apache-2.0 | Yes | Already in use; provides JpegEncoder::new_with_quality() |
| wasm-bindgen | 0.2 | WASM-JS FFI, supports Option<u8> natively | MIT/Apache-2.0 | Yes | Already in use; Option<u8> works without changes |

### Supporting

No additional libraries needed. The native HTML `<input type="range">` element and Preact's built-in state management are sufficient.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
| ---------- | --------- | -------- |
| Native range input | preact-range-slider | Adds dependency for minimal gain; native input is sufficient with ARIA attrs |
| Option<u8> param | Separate convert_image_with_options() function | More complex; two functions to maintain; Option<u8> is cleaner |
| Option<u8> param | JsValue options object via serde | Over-engineered for a single optional number; adds serialization overhead |

## Architecture Options

### Option A: Add `Option<u8>` parameter to existing `convert_image()`

Modify the existing `convert_image(input, target_format)` to `convert_image(input, target_format, quality)` where quality is `Option<u8>`.

| Aspect | Detail |
| ------ | ------ |
| Pros | Minimal API surface change; wasm-bindgen generates `quality?: number` in TS; backward-compatible (callers can pass `undefined`) |
| Cons | Slightly couples quality to the main function; if many more options are added later, the parameter list grows |
| Best When | There are only 1-2 optional parameters (quality is the only one for now) |

### Option B: Create separate `convert_image_with_options()` function

Add a new `convert_image_with_options(input, target_format, options: JsValue)` alongside the existing function.

| Aspect | Detail |
| ------ | ------ |
| Pros | Extensible for future options (quality, resize, crop, metadata); existing function untouched |
| Cons | Two conversion functions to maintain; JsValue requires serde deserialization on the Rust side; more WASM boundary complexity |
| Best When | Multiple optional parameters are expected soon |

### Option C: Replace `ImageFormat` with options struct via serde

Pass a full options object (format + quality + future options) as a single `JsValue` parameter.

| Aspect | Detail |
| ------ | ------ |
| Pros | Most flexible; single entry point for all conversion options |
| Cons | Breaking change to existing API; serde overhead on every call; more complex error handling; CLAUDE.md says to keep WASM signatures simple |
| Best When | Doing a major refactor of the conversion API |

**Recommended:** Option A -- `Option<u8>` parameter. The CLAUDE.md explicitly says "Keep WASM-exported function signatures simple" and to use `&[u8]`, `Vec<u8>`, `String`, `JsValue`, `JsError`. Adding a single `Option<u8>` follows this principle. If more options are needed later, a migration to Option B is straightforward.

## Architecture Patterns

### Recommended Rust Changes

**convert.rs** -- Add quality parameter to the convert function:

```rust
// Source: https://docs.rs/image/latest/image/codecs/jpeg/struct.JpegEncoder.html
use image::codecs::jpeg::JpegEncoder;

pub fn convert(input: Vec<u8>, target: ImageFormat, quality: Option<u8>) -> Result<Vec<u8>, ConvertError> {
    let decoded = image::load_from_memory(&input).map_err(ConvertError::Decode)?;
    drop(input);

    let mut output_buf = Vec::new();

    match target {
        ImageFormat::Jpeg => {
            let q = quality.unwrap_or(80);
            let mut encoder = JpegEncoder::new_with_quality(
                Cursor::new(&mut output_buf),
                q,
            );
            decoded.write_with_encoder(encoder)
                .map_err(ConvertError::Encode)?;
        }
        _ => {
            let output_format = target.to_image_format()
                .map_err(|e| ConvertError::UnsupportedTarget(e.to_string()))?;
            decoded.write_to(&mut Cursor::new(&mut output_buf), output_format)
                .map_err(ConvertError::Encode)?;
        }
    }

    Ok(output_buf)
}
```

**lib.rs** -- Add quality parameter to the WASM export:

```rust
#[wasm_bindgen]
pub fn convert_image(
    input: &[u8],
    target_format: &str,
    quality: Option<u8>,
) -> Result<Vec<u8>, JsError> {
    // Validate quality range
    if let Some(q) = quality {
        if q == 0 || q > 100 {
            return Err(JsError::new("Quality must be between 1 and 100"));
        }
    }

    let target = ImageFormat::from_name(target_format)
        .map_err(|e| JsError::new(&format!("Invalid target format: {e}")))?;

    let result = convert::convert(input.to_vec(), target, quality)
        .map_err(|e| JsError::new(&e.to_string()))?;

    Ok(result)
}
```

### wasm-bindgen `Option<u8>` Behavior

When `Option<u8>` is used in a `#[wasm_bindgen]` function parameter:
- TypeScript generated type: `quality?: number | undefined`
- JS callers can pass `undefined`, `null`, or a number
- Rust receives `None` for `undefined`/`null`, `Some(value)` for a number
- No serialization overhead -- primitive types are passed directly

This is verified in the [wasm-bindgen docs on numeric types](https://rustwasm.github.io/docs/wasm-bindgen/reference/types/numbers.html).

### Recommended Frontend Pattern

**QualitySlider component (new file):**

```tsx
// web/src/components/DropZone/QualitySlider.tsx
interface Props {
  quality: number
  onQualityChange: (quality: number) => void
  visible: boolean
}

export function QualitySlider({ quality, onQualityChange, visible }: Props): preact.JSX.Element | null {
  if (!visible) {
    return null
  }

  return (
    <div style={{ /* container styles */ }}>
      <label
        for="quality-slider"
        style={{ /* label styles */ }}
      >
        QUALITY: {quality}
      </label>
      <input
        id="quality-slider"
        type="range"
        min={1}
        max={100}
        value={quality}
        onInput={(e) => {
          const target = e.currentTarget as HTMLInputElement
          onQualityChange(Number(target.value))
        }}
        aria-label="Output quality"
        aria-valuemin={1}
        aria-valuemax={100}
        aria-valuenow={quality}
      />
    </div>
  )
}
```

### Worker Message Protocol Extension

The `ConvertImageRequest` interface needs one new optional field:

```typescript
export interface ConvertImageRequest {
  type: MessageType.ConvertImage
  id: number
  data: Uint8Array
  targetFormat: ValidFormat
  quality?: number  // 1-100, only used for JPEG (and future lossy formats)
}
```

This is a backward-compatible change -- existing code that constructs `ConvertImageRequest` without `quality` will still type-check because the field is optional.

### Lossy Format Detection Helper

```typescript
/** Formats that support a quality parameter (lossy encoding). */
const LOSSY_FORMATS: ReadonlySet<ValidFormat> = new Set([ValidFormat.Jpeg])

function isLossyFormat(format: ValidFormat): boolean {
  return LOSSY_FORMATS.has(format)
}
```

When WebP lossy is added later, just add `ValidFormat.WebP` to the set.

### Anti-Patterns to Avoid

- **Coupling quality defaults to the frontend:** The default quality (80) should live in the Rust code as the fallback when `None` is passed. The frontend should also default to 80 for the slider's initial value, but the Rust side must not depend on the frontend always sending a value.
- **Validating quality only on one side:** Validate in both Rust (return error for out-of-range) and TypeScript (clamp the slider, validate before sending to worker). Defense in depth.
- **Using `quality: 0` as "no quality specified":** Use `Option<u8>` / `quality?: number` with `undefined` meaning "use default." Zero is not a valid sentinel because some tools treat 0 as valid (though JPEG doesn't).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
| ------- | ----------- | ----------- | --- |
| Range slider UI | Custom slider with canvas/SVG | Native `<input type="range">` | Keyboard accessible by default, ARIA support built in, works on all browsers |
| JPEG encoding with quality | Manual JPEG encoder | `image::codecs::jpeg::JpegEncoder::new_with_quality()` | The `image` crate's encoder is battle-tested and already a dependency |
| Optional WASM params | Custom JS wrapper with default values | `Option<u8>` in wasm-bindgen | Native support, generates correct TypeScript types automatically |

## Common Pitfalls

### Pitfall 1: JPEG quality 100 produces larger files than PNG

**What goes wrong:** Users set quality to 100 expecting "perfect" output, but JPEG at quality 100 still applies lossy compression AND the output file is often larger than the PNG input.
**Why it happens:** JPEG's DCT compression at quality 100 is still lossy but generates very large coefficient tables.
**How to avoid:** Show a tooltip explaining that JPEG is always lossy. Consider capping the slider at 95 or showing a warning at 100.

### Pitfall 2: Quality parameter ignored for non-JPEG formats

**What goes wrong:** A user sets quality to 50, switches format from JPEG to PNG, and expects a smaller PNG file.
**Why it happens:** PNG is lossless; quality doesn't apply. The slider should be hidden for non-lossy formats, but the backend should also silently ignore quality for non-JPEG formats rather than erroring.
**How to avoid:** Hide the slider when the target format is not lossy. On the Rust side, only use quality for JPEG; ignore it for other formats.

### Pitfall 3: write_to vs write_with_encoder confusion

**What goes wrong:** Trying to pass quality through `DynamicImage::write_to()` -- it only accepts `ImageFormat`, not encoder options.
**Why it happens:** The `write_to` method is simpler but has no quality parameter.
**How to avoid:** Use `DynamicImage::write_with_encoder()` with a manually constructed `JpegEncoder::new_with_quality()`. Keep `write_to` for formats that don't need custom encoder options.

### Pitfall 4: WebP quality path divergence

**What goes wrong:** The existing WebP encoding uses `canvas.convertToBlob({ quality: 0.85 })` in the worker (JS-side, 0.0-1.0 scale), while JPEG quality would go through WASM (1-100 integer scale).
**Why it happens:** The `image` crate's WebP encoder is lossless-only, so the project uses the Canvas API for WebP.
**How to avoid:** When exposing WebP quality to users, normalize the UI to always show 1-100 but convert to 0.0-1.0 for the Canvas API path. Document this conversion clearly.

### Pitfall 5: Range slider "onInput" vs "onChange" in Preact

**What goes wrong:** Using `onChange` on a range input in Preact doesn't fire continuously as the user drags.
**Why it happens:** In native HTML, `onchange` fires on release, `oninput` fires continuously. Preact mirrors native behavior (unlike React which normalizes onChange to fire continuously).
**How to avoid:** Use `onInput` for live value updates as the slider is dragged.

## Security

### Known Vulnerabilities

No known CVEs or advisories found for the recommended libraries as of 2026-03-12. The `image` crate and `wasm-bindgen` are widely used and actively maintained.

### Architectural Security Risks

| Risk | Affected Architecture Options | How It Manifests | Secure Pattern | Anti-Pattern to Avoid |
| ---- | ----------------------------- | ---------------- | -------------- | --------------------- |
| Quality parameter injection | All options | Malicious JS code could pass quality values outside 1-100 (e.g., 0, 255, negative via i8 reinterpretation) | Validate quality range in Rust before use; u8 already prevents negative values | Trusting JS input without validation on the Rust side |

### Trust Boundaries

- **Worker postMessage boundary:** Quality value comes from user input via the UI slider, passes through the main thread, then to the Worker, then to WASM. Validate at the WASM entry point (`lib.rs`) that quality is in 1-100 range.
- **The quality parameter itself is not a security-sensitive field** -- worst case is a slightly different output file. The validation is for correctness, not security.

## Code Examples

### Rust: JPEG encoding with quality (verified from docs.rs)

```rust
// Source: https://docs.rs/image/latest/image/codecs/jpeg/struct.JpegEncoder.html
use std::io::Cursor;
use image::codecs::jpeg::JpegEncoder;
use image::DynamicImage;

fn encode_jpeg_with_quality(decoded: &DynamicImage, quality: u8) -> Result<Vec<u8>, image::ImageError> {
    let mut output_buf = Vec::new();
    let encoder = JpegEncoder::new_with_quality(Cursor::new(&mut output_buf), quality);
    decoded.write_with_encoder(encoder)?;
    Ok(output_buf)
}
```

### Rust: PNG encoding with compression type (verified from docs.rs)

```rust
// Source: https://docs.rs/image/latest/image/codecs/png/struct.PngEncoder.html
use std::io::Cursor;
use image::codecs::png::{PngEncoder, CompressionType, FilterType};
use image::DynamicImage;

fn encode_png_with_compression(decoded: &DynamicImage, compression: CompressionType) -> Result<Vec<u8>, image::ImageError> {
    let mut output_buf = Vec::new();
    let encoder = PngEncoder::new_with_quality(
        Cursor::new(&mut output_buf),
        compression,
        FilterType::Adaptive,
    );
    decoded.write_with_encoder(encoder)?;
    Ok(output_buf)
}
```

### TypeScript: Accessible range slider in Preact

```tsx
// Native HTML range input -- no library needed
// Source: https://www.w3.org/WAI/ARIA/apg/patterns/slider/
function QualitySlider({ quality, onChange }: { quality: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label for="quality-slider">Quality: {quality}</label>
      <input
        id="quality-slider"
        type="range"
        min={1}
        max={100}
        value={quality}
        onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
        aria-label={`Output quality: ${quality}`}
        aria-valuemin={1}
        aria-valuemax={100}
        aria-valuenow={quality}
      />
    </div>
  )
}
```

### TypeScript: Worker message with optional quality

```typescript
// Sending conversion request with quality from main thread
const request: ConvertImageRequest = {
  type: MessageType.ConvertImage,
  id: nextId++,
  data: imageBytes,
  targetFormat: ValidFormat.Jpeg,
  quality: 75,  // or omit entirely for default (80)
}
worker.postMessage(request)
```

### TypeScript: Worker receiving and passing quality to WASM

```typescript
// In worker.ts handleConvertImage
async function handleConvertImage(
  id: number,
  data: Uint8Array,
  targetFormat: ValidFormat,
  quality?: number,
): Promise<void> {
  try {
    const start = performance.now()
    let result: Uint8Array
    if (targetFormat === ValidFormat.WebP) {
      // Canvas-based path: convert 1-100 integer to 0.0-1.0 float
      const canvasQuality = quality !== undefined ? quality / 100 : 0.85
      result = await encodeWebpViaCanvas(data, canvasQuality)
    } else {
      // WASM path: pass quality directly (undefined = use Rust default of 80)
      result = convert_image(data, targetFormat, quality)
    }
    // ... post result
  } catch (e) {
    postError(id, e)
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
| ------------ | ---------------- | ------------ | ------ |
| `DynamicImage::write_to(w, format)` | `DynamicImage::write_with_encoder(encoder)` | image crate 0.24+ | Enables per-format encoder options (quality, compression) |
| `image` crate WebP encoding | Lossless only via `WebPEncoder::new_lossless()` | Current as of 0.25 | Must use Canvas API or external crate for lossy WebP |
| Separate function for optional params | `Option<T>` in wasm-bindgen params | wasm-bindgen 0.2.84+ | Clean optional parameter support for primitives |

**Deprecated/outdated:**

- `image::jpeg::JPEGEncoder` (old path): Replaced by `image::codecs::jpeg::JpegEncoder` in image 0.24+. Use the `codecs` module path.
- `PNGEncoder` (old name): Now `PngEncoder` in the `codecs::png` module.

## Validation Architecture

### Test Framework

| Property | Value |
| -------- | ----- |
| Rust test framework | Built-in `#[cfg(test)]` + cargo test |
| Rust test config | `crates/image-converter/Cargo.toml` |
| Rust quick run | `cargo test --manifest-path crates/image-converter/Cargo.toml` |
| TS unit framework | Vitest 4.0.18 |
| TS unit config | `web/vitest.config.ts` |
| TS quick run | `cd web && npm run test` |
| E2E framework | Playwright 1.58.2 |
| E2E config | `web/playwright.config.ts` |
| E2E run | `cd web && npm run test:e2e` |

### Requirements to Test Map

| Requirement | Behavior | Test Type | Automated Command | File Exists? |
| ----------- | -------- | --------- | ----------------- | ------------ |
| JPEG quality 1 produces small file | convert with quality=1, check output < quality=80 | Rust unit | `cargo test --manifest-path crates/image-converter/Cargo.toml jpeg_quality` | No -- needs creating |
| JPEG quality 100 produces large file | convert with quality=100, check output > quality=80 | Rust unit | same | No -- needs creating |
| JPEG default quality is 80 | convert with quality=None, compare to quality=Some(80) | Rust unit | same | No -- needs creating |
| Quality 0 returns error | convert with quality=0, expect Err | Rust unit | same | No -- needs creating |
| Quality 101+ returns error | convert with quality=101, expect Err | Rust unit | same | No -- needs creating |
| Quality ignored for non-JPEG | convert PNG with quality=50, should succeed identically to quality=None | Rust unit | same | No -- needs creating |
| Worker passes quality to WASM | ConvertImageRequest with quality field | TS unit (Vitest) | `cd web && npm run test` | No -- needs creating |
| Slider visible only for JPEG | Select JPEG target, slider appears; select PNG, slider hides | TS unit or E2E | `cd web && npm run test:e2e` | No -- needs creating |
| Slider value updates display | Drag slider, label shows current value | E2E | `cd web && npm run test:e2e` | No -- needs creating |
| Analytics includes quality | conversion_started event has quality property | TS unit | `cd web && npm run test` | No -- needs creating |

### Gaps (files to create before implementation)

- [ ] Rust tests in `crates/image-converter/src/convert.rs` -- add quality-specific tests to existing `#[cfg(test)]` module
- [ ] `web/tests/unit/quality-slider.test.ts` -- unit tests for quality slider component behavior
- [ ] `web/tests/e2e/quality.spec.ts` -- E2E test for quality slider visibility and value passing

## Open Questions

1. **Should quality be exposed for WebP too?**
   - What we know: The `image` crate's WebP encoder is lossless-only. The current canvas-based path already uses `quality: 0.85`. Exposing a slider for WebP would require changing the canvas quality parameter.
   - What's unclear: Whether users expect quality control for WebP, and whether the Canvas API's quality parameter provides meaningful control.
   - Recommendation: Add WebP to the lossy formats set and pass the quality through to the canvas path (dividing by 100). Low effort, good UX consistency.

2. **Should PNG compression level be exposed?**
   - What we know: PNG `CompressionType` has `Fast`, `Best`, `Default`, and `Level(u8)` for 1-9. This affects file size and encoding speed, not visual quality.
   - What's unclear: Whether users would understand/benefit from a "compression level" control for PNG.
   - Recommendation: Defer to a separate feature. PNG compression is a different concept from lossy quality and would need different UI (e.g., "Fast/Balanced/Max" toggle instead of a 1-100 slider).

3. **Should quality persist when switching formats?**
   - What we know: If a user sets quality to 60 for JPEG, switches to PNG (slider hides), then switches back to JPEG, should the slider show 60 or reset to 80?
   - What's unclear: User expectation.
   - Recommendation: Persist the quality value in state even when the slider is hidden. It's a better UX to remember the user's choice.

## Sources

### Primary (HIGH confidence)

- [docs.rs: JpegEncoder](https://docs.rs/image/latest/image/codecs/jpeg/struct.JpegEncoder.html) -- `new_with_quality()` API, quality range 1-100
- [docs.rs: PngEncoder](https://docs.rs/image/latest/image/codecs/png/struct.PngEncoder.html) -- `new_with_quality()` takes CompressionType + FilterType, not a quality number
- [docs.rs: CompressionType](https://docs.rs/image/latest/image/codecs/png/enum.CompressionType.html) -- Default, Fast, Best, Uncompressed, Level(u8) variants
- [docs.rs: WebPEncoder](https://docs.rs/image/latest/image/codecs/webp/struct.WebPEncoder.html) -- Lossless only, no quality parameter
- [docs.rs: DynamicImage](https://docs.rs/image/latest/image/enum.DynamicImage.html) -- `write_with_encoder()` accepts any ImageEncoder
- [wasm-bindgen: numeric types](https://rustwasm.github.io/docs/wasm-bindgen/reference/types/numbers.html) -- Option<u8> supported, generates nullable number in TS
- [W3C ARIA APG: Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/) -- Required ARIA attributes and keyboard interaction

### Secondary (MEDIUM confidence)

- [GitHub: image-rs/image](https://github.com/image-rs/image) -- Active maintenance, MIT/Apache-2.0 license
- [wasm-bindgen Guide](https://rustwasm.github.io/docs/wasm-bindgen/print.html) -- Full reference for type mappings -- Accessed: 2026-03-12

### Tertiary (LOW confidence)

- [Smashing Magazine: Designing The Perfect Slider](https://www.smashingmagazine.com/2017/07/designing-perfect-slider/) -- UX patterns for sliders, older article but principles still apply -- Published: 2017-07, Accessed: 2026-03-12

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- `image` crate APIs verified directly on docs.rs; wasm-bindgen Option<u8> support verified in official docs
- Architecture: HIGH -- Option A (add parameter) is the simplest path; verified that write_with_encoder exists for custom encoder usage
- Pitfalls: HIGH -- Based on direct code analysis of the existing codebase and verified API constraints (WebP lossless-only, PNG compression vs quality distinction)
- Frontend patterns: MEDIUM -- Native range input and ARIA patterns are well-documented standards; Preact-specific onInput behavior verified from general web knowledge

**Research date:** 2026-03-12
