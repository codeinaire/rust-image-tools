# Plan: Parameterized Image Processing (Phase 10)

**Date:** 2026-03-25
**Research:** `research/20260325-120000-parameterized-image-processing.md`
**Status:** Complete

## Goal

Add parameterized image processing operations (resize, crop, blur, fast blur, unsharpen, brighten, contrast, hue rotate, thumbnail) to the Rust WASM library and expose them in the frontend with an edit panel, live preview, and debounced parameter updates.

## Approach

Extend the existing decode -> transforms -> encode pipeline with a new processing step between transforms and encode. Pass structured operation parameters from JS to Rust via `serde-wasm-bindgen` (already a dependency). Add an inline edit panel component below the drop zone with slider/input controls for each operation group.

### Scope Decisions

- **Tile operation: DEFERRED** -- `image` crate has no `tile()` function; needs custom implementation
- **Crop UI: Numeric inputs V1** -- interactive drag overlay deferred to follow-up
- **Operation ordering: Fixed** -- resize -> crop -> adjustments (not user-reorderable)
- **`fast_blur`: Included** -- exposed as separate option alongside Gaussian blur

## Implementation Steps

### Step 1: Rust Processing Types (`crates/image-converter/src/processing.rs`)

Create a new module defining the operation enum and processing pipeline.

- [ ] Create `processing.rs` with `ProcessingOperation` enum:
  ```rust
  #[derive(Debug, Clone, serde::Deserialize)]
  #[serde(tag = "type", rename_all = "snake_case")]
  pub enum ProcessingOperation {
      Resize { width: u32, height: u32, filter: ResizeFilter },
      ResizeExact { width: u32, height: u32, filter: ResizeFilter },
      Thumbnail { max_width: u32, max_height: u32 },
      Crop { x: u32, y: u32, width: u32, height: u32 },
      Blur { sigma: f32 },
      FastBlur { sigma: f32 },
      Unsharpen { sigma: f32, threshold: i32 },
      Brighten { value: i32 },
      Contrast { value: f32 },
      HueRotate { degrees: i32 },
  }
  ```
- [ ] Define `ResizeFilter` enum (Nearest, Triangle, CatmullRom, Gaussian, Lanczos3) with `serde::Deserialize` and a method to convert to `image::imageops::FilterType`
- [ ] Implement `ProcessingOperation::apply(self, img: DynamicImage) -> Result<DynamicImage, ProcessingError>` with parameter validation:
  - Resize/Thumbnail: width and height must be > 0
  - Crop: x+width and y+height must not exceed image dimensions
  - Blur/FastBlur: sigma must be > 0.0
  - Brighten: value must be in -255..=255
  - Contrast: value must be in -100.0..=100.0
  - HueRotate: degrees must be in 0..=360
- [ ] Implement `apply_operations(img: DynamicImage, ops: &[ProcessingOperation]) -> Result<DynamicImage, ProcessingError>` using fold pattern
- [ ] Define `ProcessingError` enum with Display and Error impls
- [ ] Add `pub mod processing;` to `lib.rs`

**Files:** `crates/image-converter/src/processing.rs`, `crates/image-converter/src/lib.rs`

### Step 2: Rust Unit Tests for Processing

- [ ] Add `#[cfg(test)] mod tests` in `processing.rs` with test fixtures (reuse patterned image helpers pattern from `convert.rs`)
- [ ] Test each operation produces correct output dimensions:
  - Resize 100x50 image to 50x25 -> 50x25
  - Thumbnail 100x50 with max 30x30 -> 30x15 (aspect preserved)
  - Crop x=10,y=10,w=20,h=20 on 100x50 -> 20x20
- [ ] Test each adjustment operation doesn't change dimensions
- [ ] Test parameter validation error paths:
  - Resize with width=0
  - Crop exceeding image bounds
  - Blur with sigma <= 0
  - Brighten with value > 255
  - Contrast with value > 100.0
- [ ] Test operation chaining (resize then crop)
- [ ] Test empty operations list returns image unchanged
- [ ] Run `cargo test` to verify

**Files:** `crates/image-converter/src/processing.rs`

### Step 3: Integrate Processing into Convert Pipeline

Extend `convert.rs` to accept processing operations.

- [ ] Add `use crate::processing::ProcessingOperation;` to `convert.rs`
- [ ] Add new function `convert_with_processing(input: Vec<u8>, target: ImageFormat, quality: Option<u8>, transforms_list: &[Transform], operations: &[ProcessingOperation]) -> Result<Vec<u8>, ConvertError>`:
  - Same as existing `convert()` but applies processing operations after transforms
  - Add `ProcessingFailed(ProcessingError)` variant to `ConvertError`
- [ ] Add `decode_rgba_with_processing(input: &[u8], transforms_list: &[Transform], operations: &[ProcessingOperation]) -> Result<(Vec<u8>, Dimensions), ConvertError>` for WebP path
- [ ] Run `cargo test` to verify existing tests still pass

**Files:** `crates/image-converter/src/convert.rs`

### Step 4: WASM Exports

Add new WASM-exported functions in `lib.rs`.

- [ ] Add `process_and_convert(input: &[u8], target_format: &str, quality: Option<u8>, transforms_csv: &str, operations: JsValue) -> Result<Vec<u8>, JsError>`:
  - Parse transforms_csv with existing `parse_transforms`
  - Deserialize operations with `serde_wasm_bindgen::from_value::<Vec<ProcessingOperation>>(operations)`
  - Call `convert::convert_with_processing`
- [ ] Add `decode_rgba_with_processing(input: &[u8], transforms_csv: &str, operations: JsValue) -> Result<JsValue, JsError>`:
  - Returns `{ rgba, width, height }` like existing `decode_to_rgba_with_transforms`
  - Used for WebP encoding path
- [ ] Build WASM: `wasm-pack build crates/image-converter --target web --release`
- [ ] Run `cargo clippy -- -D warnings` and `cargo fmt`

**Files:** `crates/image-converter/src/lib.rs`

### Step 5: TypeScript Types for Processing Operations

Define TypeScript types matching the Rust serde deserialization format.

- [ ] Add to `web/src/types/interfaces.ts`:
  ```typescript
  export type ResizeFilter = 'nearest' | 'triangle' | 'catmull_rom' | 'gaussian' | 'lanczos3'

  export type ProcessingOperation =
    | { type: 'resize'; width: number; height: number; filter: ResizeFilter }
    | { type: 'resize_exact'; width: number; height: number; filter: ResizeFilter }
    | { type: 'thumbnail'; max_width: number; max_height: number }
    | { type: 'crop'; x: number; y: number; width: number; height: number }
    | { type: 'blur'; sigma: number }
    | { type: 'fast_blur'; sigma: number }
    | { type: 'unsharpen'; sigma: number; threshold: number }
    | { type: 'brighten'; value: number }
    | { type: 'contrast'; value: number }
    | { type: 'hue_rotate'; degrees: number }
  ```
- [ ] Export new types from `web/src/types/index.ts`

**Files:** `web/src/types/interfaces.ts`, `web/src/types/index.ts`

### Step 6: Worker Protocol Extension

Extend the worker message protocol to support processing operations.

- [ ] Add `ProcessImage` to `MessageType` enum in `web/src/types/enums.ts`
- [ ] Add `ProcessImageRequest` interface to `web/src/types/interfaces.ts`:
  ```typescript
  export interface ProcessImageRequest {
    type: MessageType.ProcessImage
    id: number
    data: Uint8Array
    targetFormat: ValidFormat
    quality?: number
    transforms?: string[]
    operations?: ProcessingOperation[]
  }
  ```
- [ ] Add `ProcessImageSuccessResponse` interface
- [ ] Update `WorkerRequest` and `WorkerResponse` union types in `web/src/types/types.ts`
- [ ] Update `web/src/worker.ts`:
  - Import `process_and_convert` and `decode_rgba_with_processing` from WASM package
  - Add `case MessageType.ProcessImage:` handler
  - For WebP with operations, use the new `decode_rgba_with_processing` WASM function then Canvas encoding
- [ ] Update `web/src/lib/image-converter.ts`:
  - Add `processImage(data, targetFormat, quality, transforms, operations)` method
  - Returns `Promise<Uint8Array>`

**Files:** `web/src/types/enums.ts`, `web/src/types/interfaces.ts`, `web/src/types/types.ts`, `web/src/worker.ts`, `web/src/lib/image-converter.ts`

### Step 7: Processing State Hook (`useProcessing`)

Create a new hook to manage processing operation state.

- [ ] Create `web/src/hooks/useProcessing.ts`:
  - State for each operation's parameters (all default to "off"/neutral values)
  - `ResizeState`: `{ enabled: boolean, width: number, height: number, filter: ResizeFilter, lockAspectRatio: boolean }`
  - `CropState`: `{ enabled: boolean, x: number, y: number, width: number, height: number }`
  - `AdjustmentsState`: brightness (0), contrast (0), hueRotate (0), blurSigma (0), blurType ('gaussian'|'fast'), unsharpenSigma (0), unsharpenThreshold (0)
  - `buildOperations()`: converts enabled states into ordered `ProcessingOperation[]` array
  - `resetOperation(name)` and `resetAll()` functions
  - Tracks whether any operations are active (`hasActiveOperations`)
- [ ] Export hook and types

**Files:** `web/src/hooks/useProcessing.ts`

### Step 8: Edit Panel Component

Create the main edit panel UI component.

- [ ] Create `web/src/components/EditPanel.tsx`:
  - Inline panel (not modal) that appears below DropZone when an image is loaded
  - Collapsible sections: "RESIZE", "CROP", "ADJUSTMENTS"
  - Each section has an enable/disable toggle
  - Cyberpunk styling consistent with existing UI (monospace fonts, cyan/yellow accents, border styling)
- [ ] Resize section:
  - Width/height number inputs
  - Aspect ratio lock toggle (chain-link icon)
  - When locked: changing width auto-updates height (and vice versa) based on source image aspect ratio
  - Filter type dropdown: Nearest, Triangle (Bilinear), CatmullRom, Gaussian, Lanczos3
  - Default filter: Lanczos3
- [ ] Crop section:
  - X, Y, Width, Height number inputs
  - Max values constrained to image dimensions
  - "Full image" reset button
- [ ] Adjustments section:
  - Brightness slider: -255 to 255 (default 0)
  - Contrast slider: -100 to 100 (default 0)
  - Hue rotate slider: 0 to 360 (default 0)
  - Blur sigma slider: 0 to 20 (default 0, 0 = no blur)
  - Blur type toggle: Gaussian / Fast
  - Unsharpen sigma slider: 0 to 10 (default 0)
  - Unsharpen threshold slider: 0 to 20 (default 0)
- [ ] "Reset All" button at bottom of panel
- [ ] All parameter changes emit via `onChange` callback with the current operations array

**Files:** `web/src/components/EditPanel.tsx`

### Step 9: Slider Component

Create a reusable slider component for adjustments.

- [ ] Create `web/src/components/Slider.tsx`:
  - Props: min, max, step, value, onChange, label, disabled
  - Shows current value next to label
  - Cyberpunk styling: custom track (dark with cyan accent), custom thumb
  - Uses native `<input type="range">` with custom CSS
  - Calls onChange on `input` event (not just `change`) for real-time feedback

**Files:** `web/src/components/Slider.tsx`

### Step 10: Integration with ImageConverter

Wire the edit panel into the main converter flow.

- [ ] In `ImageConverter.tsx`:
  - Import and render `EditPanel` below `DropZone` (visible when `state.fileInfo` is not null)
  - Pass image dimensions to EditPanel for validation constraints
  - Add `useProcessing` hook for operations state management
  - When operations change (debounced 300ms), trigger processing via worker
  - For preview: pass operations to worker with a preview flag (or use thumbnail approach)
- [ ] Update `useConverter.ts`:
  - Add `operations` parameter to `handleConvert`
  - Update `scheduleTransformConvert` to also include operations
  - The debounced convert now sends both transforms AND operations
- [ ] Ensure "Download" button triggers full-resolution processing (not preview)

**Files:** `web/src/components/ImageConverter.tsx`, `web/src/hooks/useConverter.ts`

### Step 11: Preview Mode

Implement low-resolution preview for interactive parameter adjustment.

- [ ] Add `preview_operations(input: &[u8], operations: JsValue, max_width: u32) -> Result<JsValue, JsError>` WASM export:
  - Thumbnails input to `max_width` (preserving aspect ratio)
  - Applies all operations to the thumbnail
  - Returns `{ rgba, width, height }`
- [ ] Add `MessageType.PreviewOperations` to worker protocol
- [ ] Worker handler: calls `preview_operations`, returns RGBA + dimensions
- [ ] Frontend: converts RGBA to ImageData, draws on an OffscreenCanvas, creates blob URL
- [ ] ImageConverter renders preview image when operations are active
- [ ] Preview is debounced (300ms) to avoid overwhelming the worker

**Files:** `crates/image-converter/src/lib.rs`, `web/src/worker.ts`, `web/src/types/`, `web/src/lib/image-converter.ts`, `web/src/components/ImageConverter.tsx`

### Step 12: TypeScript Unit Tests

- [ ] Create `web/tests/unit/processing.test.ts`:
  - Test `useProcessing` hook: buildOperations produces correct array
  - Test aspect ratio lock: changing width updates height proportionally
  - Test resetOperation and resetAll
  - Test that disabled operations are not included in output
- [ ] Create `web/tests/unit/edit-panel.test.ts`:
  - Test EditPanel renders sections
  - Test slider interactions update state
  - Test reset buttons clear values
- [ ] Run `cd web && npm run check:all`

**Files:** `web/tests/unit/processing.test.ts`, `web/tests/unit/edit-panel.test.ts`

### Step 13: Final Verification

- [ ] Run full Rust test suite: `cargo test --manifest-path crates/image-converter/Cargo.toml`
- [ ] Run Rust linting: `cargo clippy -- -D warnings` and `cargo fmt -- --check`
- [ ] Build WASM: `wasm-pack build crates/image-converter --target web --release`
- [ ] Run frontend checks: `cd web && npm run check:all`
- [ ] Build frontend: `cd web && npm run build`
- [ ] Manual smoke test: load image, resize, apply blur, adjust brightness, download

## Verification

- [ ] All existing tests pass (no regressions)
- [ ] New Rust unit tests pass for each processing operation
- [ ] Processing operations apply correctly: resize changes dimensions, blur softens image, brighten lightens image
- [ ] Parameter validation rejects invalid inputs with clear error messages
- [ ] Edit panel renders with all controls and matches cyberpunk theme
- [ ] Debounced preview updates (~300ms delay) work smoothly
- [ ] Full-resolution processing on download works correctly
- [ ] Aspect ratio lock works: changing width updates height proportionally
- [ ] Reset per-operation and Reset All clear values correctly
- [ ] WebP output path works with processing operations (Canvas encoding)
- [ ] `cargo clippy`, `cargo fmt`, and `npm run check:all` all pass clean

## Dependencies

- No new Rust crate dependencies (uses existing `image`, `serde`, `serde-wasm-bindgen`)
- No new npm dependencies
- Phase 5 (Simple Transforms) must be complete -- it is

## Risks

- **WASM binary size**: Processing operations add ~32-53 KB gzipped. Acceptable per ROADMAP budget.
- **Memory pressure**: Chaining many operations on large images creates intermediate allocations. Mitigated by preview mode (operations applied to thumbnail) and explicit drops.
- **`clippy::as_conversions`**: May be needed for `fast_blur` return type conversion. Use `#[allow]` with safety comments.
