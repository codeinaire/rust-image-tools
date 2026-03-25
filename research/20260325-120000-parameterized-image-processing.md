# Research: Parameterized Image Processing (Phase 10)

**Date:** 2026-03-25
**Status:** Complete
**Confidence:** HIGH

## 1. Executive Summary

Phase 10 adds parameterized image processing (resize, crop, blur, brighten, contrast, hue rotate, unsharpen, thumbnail, tile) to the existing image converter. The `image` crate's `imageops` module provides all needed operations with no additional dependencies. The main architectural decisions are: (1) how to pass structured operation parameters across the WASM boundary, and (2) how to handle live preview without lag.

**Recommendation:** Use `serde-wasm-bindgen` (already a dependency) to deserialize a `JsValue` array into Rust structs -- avoids adding `serde_json` while keeping type-safe deserialization. For preview, downscale to ~400px before applying operations.

## 2. Rust `image` crate `imageops` API

### Available Operations

All functions operate on `DynamicImage` (the type already used throughout the codebase):

| Operation | Function | Signature (simplified) | Notes |
|-----------|----------|----------------------|-------|
| Resize | `img.resize(w, h, filter)` | `(u32, u32, FilterType) -> DynamicImage` | Aspect-ratio-preserving resize to fit within w x h |
| Resize exact | `img.resize_exact(w, h, filter)` | `(u32, u32, FilterType) -> DynamicImage` | Stretches/squishes to exact dimensions |
| Thumbnail | `img.thumbnail(w, h)` | `(u32, u32) -> DynamicImage` | Fast resize preserving aspect ratio (Nearest filter) |
| Thumbnail exact | `img.thumbnail_exact(w, h)` | `(u32, u32) -> DynamicImage` | Fast resize to exact dimensions |
| Crop | `img.crop_imm(x, y, w, h)` | `(u32, u32, u32, u32) -> DynamicImage` | Immutable crop (no mutation) |
| Blur | `img.blur(sigma)` | `(f32) -> DynamicImage` | Gaussian blur |
| Fast blur | `imageops::fast_blur(&img, sigma)` | Free function, not a method on DynamicImage | Box blur approximation |
| Unsharpen | `img.unsharpen(sigma, threshold)` | `(f32, i32) -> DynamicImage` | Unsharp mask |
| Brighten | `img.brighten(value)` | `(i32) -> DynamicImage` | Add to each channel (-255 to 255) |
| Contrast | `img.adjust_contrast(c)` | `(f32) -> DynamicImage` | Adjust contrast (-100.0 to 100.0) |
| Hue rotate | `img.huerotate(degrees)` | `(i32) -> DynamicImage` | Rotate hue in HSL space |

### FilterType Enum

```rust
pub enum FilterType {
    Nearest,     // Fastest, pixelated
    Triangle,    // Bilinear interpolation
    CatmullRom,  // Good quality/speed balance
    Gaussian,    // Gaussian sampling
    Lanczos3,    // Highest quality, slowest
}
```

### `tile()` Investigation

The `image` crate does NOT have a `tile()` function in `imageops`. The ROADMAP mentions it but it would need custom implementation (repeated `overlay()` calls). **Recommend deferring tile to a follow-up** since it's low-priority and needs custom code.

### `fast_blur` Note

`fast_blur` is a free function `image::imageops::fast_blur(img: &I, sigma: f32)` -- NOT a method on DynamicImage. It returns `ImageBuffer`, not `DynamicImage`, so it needs conversion: `DynamicImage::ImageRgba8(fast_blur(&img.to_rgba8(), sigma))`.

### Chaining Operations

Operations can be chained naturally since they all consume/return `DynamicImage`:

```rust
let result = operations.iter().fold(image, |img, op| op.apply(img));
```

This matches the existing `apply_transforms` pattern in `transforms.rs`.

## 3. WASM Boundary: Passing Structured Parameters

### Option A: JSON string via `serde_json` (NOT recommended)
- Adds `serde_json` dependency (~40 KB uncompressed / ~15 KB gzipped)
- Simple to use: `serde_json::from_str::<Vec<ProcessingOperation>>(json_str)`
- Con: Unnecessary binary size increase

### Option B: `serde-wasm-bindgen` with `JsValue` (RECOMMENDED)
- Already a dependency in `Cargo.toml`
- Deserialize directly: `serde_wasm_bindgen::from_value::<Vec<ProcessingOperation>>(js_value)`
- Zero additional WASM size
- Type-safe with `#[derive(Deserialize)]`
- The JS side passes a plain array of objects, which `serde-wasm-bindgen` converts

### Option C: Manual `JsValue` parsing
- No serde overhead at all
- Extremely verbose and error-prone
- Not recommended for complex nested structures

**Decision: Option B.** The project already depends on `serde` and `serde-wasm-bindgen`. Using `from_value` adds negligible binary size and provides type-safe deserialization.

## 4. Existing Architecture Analysis

### Current Pipeline (convert.rs)
```
decode -> apply_transforms -> encode
```

The new pipeline needs to be:
```
decode -> apply_transforms -> apply_processing_operations -> encode
```

### Key Integration Points

1. **`convert::convert()`** -- Currently takes `transforms_list: &[Transform]`. Needs extension to also accept processing operations. Two options:
   - Add a new parameter `operations: &[ProcessingOperation]`
   - Or create a new function `convert_with_processing()` to avoid changing the signature

2. **`lib.rs` WASM exports** -- Currently has `convert_image_with_transforms()`. Needs a new export that also accepts operations.

3. **Worker protocol** -- `ConvertImageRequest` currently has `transforms?: string[]`. Needs `operations?: ProcessingOperation[]`.

4. **`useConverter` hook** -- Currently manages `transforms: TransformName[]`. Needs extension for processing operations state.

### Relationship to Existing Transforms

Existing transforms (flip, rotate, grayscale, invert) are simple toggles with no parameters. The new processing operations have parameters. These are conceptually different:
- Transforms: applied as a set, order mostly doesn't matter (except rotation)
- Processing operations: applied in explicit order, each with parameters

**Recommendation:** Keep transforms and processing operations as separate concepts. Transforms remain as comma-separated strings. Processing operations use the new `JsValue` approach. Both are applied between decode and encode, transforms first, then processing operations.

## 5. Frontend Architecture

### UI Approach

The existing `TransformModal` handles simple toggles. Processing operations need:
- Numeric inputs (width, height, x, y coordinates)
- Sliders (brightness, contrast, blur sigma, hue)
- Dropdowns (filter type)
- Toggle (aspect ratio lock for resize)

**Recommendation:** Add processing controls to the existing `TransformModal`, extending the sidebar with collapsible operation groups. This keeps the modal pattern consistent and avoids introducing a second editing UI.

Alternatively, create a separate "Edit Panel" as an inline section below the drop zone (not a modal), which matches the ROADMAP's description. This approach is better because:
- Operations are always visible (no need to open a modal)
- Users can see the preview while adjusting parameters
- More screen real estate for sliders and inputs

### Preview Strategy

For live preview during parameter adjustment:
1. Downscale the source image to ~400px wide on the Rust side
2. Apply all operations to the thumbnail
3. Display the thumbnail as preview
4. On "Download" or "Convert", apply operations at full resolution

This requires a new WASM export: `preview_with_operations(input, operations, max_preview_width)` that internally thumbnails first.

### Debounce

Already implemented pattern: `useConverter.ts` uses `TRANSFORM_DEBOUNCE_MS = 300` for transform changes. The same pattern applies to processing operation parameter changes.

### Crop UI

Two approaches:
1. **Numeric inputs** (x, y, width, height) -- simpler, less UX-friendly
2. **Interactive overlay** -- draggable rectangle on the preview image

**Recommendation for V1:** Start with numeric inputs. An interactive crop overlay is a significant frontend effort (mouse/touch drag, resize handles, aspect ratio constraints) and can be added as a follow-up enhancement.

## 6. Performance Considerations

### Memory Management
- Drop input buffer after decode (already done)
- Processing operations may create intermediate `DynamicImage` allocations -- each operation creates a new image. For a chain of 5 operations on a 10MP image, this could use ~200MB peak.
- Mitigate: operations consume the previous image, allowing the allocator to reuse memory.

### Preview Resolution
- 400px wide thumbnail of a 4000px image = 100x reduction in pixels processed
- Makes even expensive operations (blur, resize with Lanczos3) feel instant
- Full resolution only on final convert/download

### `as_conversions` Lint
The `clippy::as_conversions` lint is denied at the workspace level. The `image` crate's `FilterType` and `imageops` functions use safe types (u32, i32, f32), so most conversions should be clean. Where `as` is needed (e.g., converting between numeric types), use `#[allow(clippy::as_conversions)]` with a safety comment.

## 7. Recommended Implementation Order

1. **Rust processing module** -- Define types and implement operations
2. **WASM export** -- Add `process_and_convert` function
3. **Worker protocol** -- Extend message types for operations
4. **Frontend types** -- TypeScript types for operations
5. **Edit Panel UI** -- Component with controls for each operation
6. **Preview mode** -- Low-resolution preview for parameter adjustment
7. **Integration** -- Wire everything together with debounced updates
8. **Tests** -- Rust unit tests + TypeScript unit tests

## 8. Open Questions

| Question | Confidence | Recommendation |
|----------|-----------|----------------|
| Should tile be included in V1? | HIGH | No -- defer to follow-up, needs custom implementation |
| Should fast_blur be separate from blur? | MEDIUM | Yes, expose both -- fast_blur is noticeably faster for preview |
| Should crop UI be interactive or numeric? | HIGH | Numeric inputs for V1, interactive overlay as follow-up |
| Should operations be reorderable? | MEDIUM | No for V1 -- fixed order (resize -> crop -> adjustments) is simpler and covers most use cases |
| Separate WASM function or extend existing? | HIGH | New function `process_and_convert` -- avoids breaking existing API |
