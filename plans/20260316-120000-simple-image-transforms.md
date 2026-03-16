# Plan: Simple Image Transforms (Flip, Rotate, Grayscale, Invert)

**Date:** 2026-03-16
**Research:** `research/20260316-120000-simple-image-transforms.md`
**Status:** Complete

## Goal

Add one-click image transforms (flip horizontal/vertical, rotate 90/180/270, grayscale, invert) to the image conversion pipeline. Transforms are applied to the decoded `DynamicImage` between decode and encode. The frontend provides a toolbar with icon buttons that trigger re-conversion with 300ms debounce.

Dither is deferred to a future phase (requires custom ColorMap implementation).

## Steps

### Step 1: Create Rust transforms module

**File:** `crates/image-converter/src/transforms.rs` (NEW)

Create a `Transform` enum with variants: `FlipHorizontal`, `FlipVertical`, `Rotate90`, `Rotate180`, `Rotate270`, `Grayscale`, `Invert`.

Implement:
- `Transform::from_name(name: &str) -> Result<Self, TransformError>` -- parse from string names: `"flip_horizontal"`, `"flip_vertical"`, `"rotate_90"`, `"rotate_180"`, `"rotate_270"`, `"grayscale"`, `"invert"`
- `Transform::apply(self, img: DynamicImage) -> DynamicImage` -- apply a single transform using the corresponding `DynamicImage` method
- `pub fn apply_transforms(img: DynamicImage, transforms: &[Transform]) -> DynamicImage` -- apply all transforms in order
- `pub fn parse_transforms(input: &str) -> Result<Vec<Transform>, TransformError>` -- parse comma-separated string into Vec, empty string returns empty Vec
- `TransformError` enum with `UnknownTransform(String)` variant, implementing Display and Error

Add `#[cfg(test)]` module with tests:
- Dimension change after rotate_90 (50x40 -> 40x50)
- Invert pixel values (255 - original for RGB channels)
- Grayscale produces R=G=B pixels
- Flip horizontal mirrors pixel positions
- rotate_90 x4 = original (identity)
- Multiple transforms applied in order
- Empty transforms = unchanged
- Unknown transform name returns error
- Parse comma-separated string

### Step 2: Integrate transforms into convert pipeline

**File:** `crates/image-converter/src/convert.rs` (MODIFY)

Update `convert()` signature to accept transforms:
```rust
pub fn convert(
    input: Vec<u8>,
    target: ImageFormat,
    quality: Option<u8>,
    transforms: &[Transform],
) -> Result<Vec<u8>, ConvertError>
```

Add `ConvertError::Transform(TransformError)` variant.

Insert `apply_transforms` call between decode and encode:
```rust
let decoded = image::load_from_memory(&input).map_err(ConvertError::Decode)?;
drop(input);
let decoded = apply_transforms(decoded, transforms);
```

Update all existing test calls to pass empty slice `&[]` for transforms.

**File:** `crates/image-converter/src/lib.rs` (MODIFY)

Add `pub mod transforms;`.

Update `convert_image` to accept optional transforms:
```rust
pub fn convert_image(
    input: &[u8],
    target_format: &str,
    quality: Option<u8>,
    transforms: Option<String>,
) -> Result<Vec<u8>, JsError>
```

Parse transforms string and pass to `convert::convert()`.

### Step 3: Verify Rust builds and tests pass

Run:
```bash
cargo fmt --manifest-path crates/image-converter/Cargo.toml
cargo clippy --manifest-path crates/image-converter/Cargo.toml -- -D warnings
cargo test --manifest-path crates/image-converter/Cargo.toml
```

All must pass before proceeding.

### Step 4: Update TypeScript types and worker

**File:** `web/src/types/interfaces.ts` (MODIFY)

Add `transforms?: string[]` to `ConvertImageRequest`.

**File:** `web/src/worker.ts` (MODIFY)

Update `handleConvertImage` to accept and pass transforms:
- Join the `transforms` array into a comma-separated string
- Pass to `convert_image` as the 4th argument
- Also update `handleBenchmarkImages` similarly (pass empty string/undefined)

Update the `onmessage` handler to pass `request.transforms` through.

**File:** `web/src/lib/image-converter.ts` (MODIFY)

Add `transforms?: string[]` parameter to `convertImage()` and `convertImageTimed()`.
Pass through in the worker request message.

### Step 5: Add transforms state and debounce to useConverter

**File:** `web/src/hooks/useConverter.ts` (MODIFY)

Add:
- `transforms` state as `string[]` (initially `[]`)
- `setTransforms` setter exposed from the hook
- Reset transforms to `[]` in `handleFile` when a new image is loaded
- Pass `transforms` through to `converter.convertImage()` in `handleConvert`
- Add 300ms debounce: when transforms change and fileInfo is present, auto-trigger conversion
- Include `transforms` in the `trackConversionStarted` analytics call
- Smart rotation helper: expose `addRotateCW()` and `addRotateCCW()` that normalize rotation count

Return type updated to include `transforms`, `setTransforms`, `addRotateCW`, `addRotateCCW`, `toggleTransform`.

### Step 6: Create TransformToolbar component

**File:** `web/src/components/TransformToolbar.tsx` (NEW)

A horizontal toolbar with 6 icon buttons:
1. Flip Horizontal (mirror-h SVG icon)
2. Flip Vertical (mirror-v SVG icon)
3. Rotate CW (rotate-cw SVG icon)
4. Rotate CCW (rotate-ccw SVG icon)
5. Grayscale toggle (circle-half SVG icon)
6. Invert toggle (contrast SVG icon)

Props:
```typescript
interface TransformToolbarProps {
  transforms: string[]
  onRotateCW: () => void
  onRotateCCW: () => void
  onToggleFlipH: () => void
  onToggleFlipV: () => void
  onToggleGrayscale: () => void
  onToggleInvert: () => void
  disabled: boolean
}
```

Styling:
- Cyberpunk theme consistent with existing UI (cyan accents, dark background)
- Active transforms highlighted with yellow/cyan glow
- Buttons disabled during conversion
- Compact layout, fits within the DropZone area

### Step 7: Wire TransformToolbar into UI

**File:** `web/src/components/ImageConverter.tsx` (MODIFY)

Pass transforms state and handlers from `useConverter` down to DropZone.

**File:** `web/src/components/DropZone/index.tsx` (MODIFY)

Add TransformToolbar between the file info section and the format/convert controls row. Only visible when `fileInfo` is present and `controlsVisible` is true.

Props to add:
- `transforms: string[]`
- `onRotateCW`, `onRotateCCW`, `onToggleFlipH`, `onToggleFlipV`, `onToggleGrayscale`, `onToggleInvert`

### Step 8: Update analytics

**File:** `web/src/analytics.ts` (MODIFY)

Update `trackConversionStarted` to accept optional `transforms` array:
```typescript
export function trackConversionStarted(
  props: FormatPairProps & {
    file_size_bytes: number
    megapixels: number
    quality?: number
    transforms?: string[]
  },
): void
```

### Step 9: Build WASM and verify frontend

```bash
wasm-pack build crates/image-converter --target web --release
cd web && npm run check:all
```

### Step 10: Manual verification

- Load an image
- Click each transform button and verify preview updates
- Verify rotate 90 changes dimensions
- Verify grayscale/invert toggle on/off
- Verify transforms reset when loading a new image
- Verify conversion works with transforms applied
- Download converted+transformed image and verify it's correct

## Verification

- [ ] `cargo test` passes with all new transform tests
- [ ] `cargo clippy -- -D warnings` passes
- [ ] `cargo fmt -- --check` passes
- [ ] `wasm-pack build` succeeds
- [ ] `cd web && npm run check:all` passes
- [ ] Transform toolbar appears when image is loaded
- [ ] Each transform button works correctly
- [ ] Transforms reset on new image
- [ ] Debounced re-conversion works
- [ ] Analytics include transforms data

## Deferred

- **Dither:** Requires custom `ColorMap` implementation. Will be a separate phase.
