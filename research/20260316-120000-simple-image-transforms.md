# Research: Simple Image Transforms (Flip, Rotate, Grayscale, Invert, Dither)

**Date:** 2026-03-16
**Confidence:** HIGH
**Status:** Complete

## 1. Objective

Add one-click image transforms (flip, rotate, grayscale, invert, dither) applied to the decoded `DynamicImage` before encoding, extending the existing conversion pipeline.

## 2. image Crate API Analysis

### Available Functions on `DynamicImage`

The `image` crate v0.25 provides transform methods directly on `DynamicImage`:

| Operation | Method | Signature | Notes |
|---|---|---|---|
| Flip horizontal | `fliph()` | `fn fliph(&self) -> DynamicImage` | Returns new image |
| Flip vertical | `flipv()` | `fn flipv(&self) -> DynamicImage` | Returns new image |
| Rotate 90 CW | `rotate90()` | `fn rotate90(&self) -> DynamicImage` | Returns new image, swaps w/h |
| Rotate 180 | `rotate180()` | `fn rotate180(&self) -> DynamicImage` | Returns new image |
| Rotate 270 CW | `rotate270()` | `fn rotate270(&self) -> DynamicImage` | Returns new image, swaps w/h |
| Grayscale | `grayscale()` | `fn grayscale(&self) -> DynamicImage` | Returns `ImageLuma8` or `ImageLumaA8` |
| Invert | `invert()` | `fn invert(&mut self)` | In-place mutation |

These are methods on `DynamicImage` itself, NOT `imageops::` functions. The `imageops` module has lower-level equivalents that work on `GenericImageView` but the `DynamicImage` methods are cleaner for our use case.

### Dither

The `image` crate does NOT have a built-in `dither()` function on `DynamicImage`. The `imageops` module does provide `dither()` but it works on `ImageBuffer<Luma<u8>, Vec<u8>>` (grayscale only) and requires a `ColorMap` trait implementation.

For a Floyd-Steinberg dither to a reduced color palette (useful for GIF/indexed PNG), we would need to:
1. Convert to `Rgba8`
2. Implement a custom `ColorMap` or use a simple palette
3. Apply error diffusion manually

**Recommendation:** Defer dither to a future phase. It requires significant custom implementation and is only useful for GIF output. The other 7 transforms are trivial to implement with the existing API.

## 3. Rust Integration Points

### Current Pipeline (convert.rs)

```
input bytes -> decode (load_from_memory) -> drop input -> encode -> output bytes
```

### Proposed Pipeline

```
input bytes -> decode -> drop input -> apply_transforms -> encode -> output bytes
```

### Transform Enum Design

Define a `Transform` enum in a new `transforms.rs` module:

```rust
pub enum Transform {
    FlipHorizontal,
    FlipVertical,
    Rotate90,
    Rotate180,
    Rotate270,
    Grayscale,
    Invert,
}
```

Parse from string names (matching the JS side): `"flip_horizontal"`, `"flip_vertical"`, `"rotate_90"`, `"rotate_180"`, `"rotate_270"`, `"grayscale"`, `"invert"`.

### WASM Boundary

Two options for passing transforms across the WASM boundary:

**Option A: Comma-separated string**
```rust
pub fn convert_image(input: &[u8], target_format: &str, quality: Option<u8>, transforms: &str) -> Result<Vec<u8>, JsError>
```
Where `transforms` is `"rotate_90,grayscale"` or empty string for none.

**Option B: New function signature with JsValue**
Use `serde_wasm_bindgen` to deserialize a JS array.

**Recommendation:** Option A (comma-separated string). It's simpler, avoids serde overhead for a small list, and keeps the WASM boundary clean. The existing `convert_image` function already uses `&str` for format names.

However, adding a 4th parameter to `convert_image` is a breaking change. We should add a new function `convert_image_with_transforms` or make `transforms` an optional parameter. Since `wasm_bindgen` supports `Option<String>`, we can use that:

```rust
pub fn convert_image(
    input: &[u8],
    target_format: &str,
    quality: Option<u8>,
    transforms: Option<String>,
) -> Result<Vec<u8>, JsError>
```

This is backward-compatible since JS callers that don't pass the 4th arg will get `None`.

## 4. Frontend Integration Points

### Worker Message Extension

Extend `ConvertImageRequest` interface:
```typescript
interface ConvertImageRequest {
  type: MessageType.ConvertImage
  id: number
  data: Uint8Array
  targetFormat: ValidFormat
  quality?: number
  transforms?: string[]  // NEW
}
```

The worker joins the array into a comma-separated string before calling `convert_image`.

### State Management

Transforms state is an ordered `string[]` managed in `useConverter`. Each button click toggles or adds a transform.

Key behaviors:
- Rotate operations accumulate (clicking rotate 90 three times = rotate 270)
- Grayscale and Invert are toggles (on/off)
- Flip H and Flip V are toggles
- Transforms reset when a new image is loaded
- Transform changes trigger re-conversion with 300ms debounce

### UI Component: TransformToolbar

A horizontal toolbar with icon buttons placed between the file info area and the format/convert controls. Buttons:
- Flip H (mirror icon)
- Flip V (mirror icon, vertical)
- Rotate CW (rotate clockwise icon)
- Rotate CCW (rotate counter-clockwise icon)
- Grayscale (circle half-filled icon)
- Invert (contrast icon)

Use simple SVG icons inline. No icon library needed for 6 icons.

### Debounce on Transform Change

When transforms change, auto-trigger re-conversion after 300ms debounce. This means:
- User clicks Rotate 90 -> 300ms delay -> convert with ["rotate_90"]
- User quickly clicks Rotate 90 again within 300ms -> cancel previous, 300ms delay -> convert with ["rotate_90", "rotate_90"] (= rotate 180)

This provides instant visual feedback without overwhelming the worker.

### Smart Rotate Accumulation

Rather than storing `["rotate_90", "rotate_90", "rotate_90"]`, normalize rotations:
- 0 rotations = no transform
- 1 rotation = rotate_90
- 2 rotations = rotate_180
- 3 rotations = rotate_270
- 4 rotations = 0 (full circle, remove)

This keeps the state clean and the string short.

## 5. Testing Strategy

### Rust Unit Tests

1. **Dimension tests:** rotate_90 on a 50x40 image should produce 40x50
2. **Pixel tests:** invert on a known pixel should produce 255-original for each channel
3. **Grayscale test:** output should be grayscale (R=G=B for each pixel)
4. **Flip tests:** flip_horizontal should mirror pixel positions
5. **Identity tests:** rotate_90 applied 4 times = original
6. **Multiple transforms:** apply rotate_90 then flip_horizontal, verify result
7. **Empty transforms:** no transforms = original image
8. **Unknown transform name:** should return error

### Frontend Unit Tests

1. Transform state management (toggle, accumulate rotations)
2. Debounce behavior
3. Reset on new image

## 6. Files to Modify

### Rust
- **NEW:** `crates/image-converter/src/transforms.rs` - Transform enum, parsing, apply function
- **MODIFY:** `crates/image-converter/src/lib.rs` - Add `pub mod transforms;`, update `convert_image` signature
- **MODIFY:** `crates/image-converter/src/convert.rs` - Add transforms parameter to `convert()`, apply between decode and encode

### TypeScript
- **MODIFY:** `web/src/types/interfaces.ts` - Add `transforms` to `ConvertImageRequest`
- **MODIFY:** `web/src/worker.ts` - Pass transforms to `convert_image`
- **MODIFY:** `web/src/lib/image-converter.ts` - Add transforms param to `convertImage`/`convertImageTimed`
- **MODIFY:** `web/src/hooks/useConverter.ts` - Add transforms state, debounce logic, reset on new image
- **NEW:** `web/src/components/TransformToolbar.tsx` - Transform buttons UI
- **MODIFY:** `web/src/components/DropZone/index.tsx` - Include TransformToolbar
- **MODIFY:** `web/src/components/ImageConverter.tsx` - Wire transforms state
- **MODIFY:** `web/src/analytics.ts` - Add transforms to conversion_started event

## 7. Open Questions

None critical. Dither is deferred as noted above.
