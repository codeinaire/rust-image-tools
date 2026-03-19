# Plan: Image Metadata + EXIF Display

**Status:** Complete
**Date:** 2026-03-19
**Research:** [research/20260319-155839-image-metadata-exif-display.md](../research/20260319-155839-image-metadata-exif-display.md)

## Overview

Extract and display image metadata from uploaded files — EXIF data for JPEG/TIFF/WebP (camera model, focal length, ISO, GPS, date taken), PNG text chunks, and general file info (color space, bit depth, ICC profile presence). All extraction happens in Rust/WASM; metadata is displayed in a collapsible panel in the frontend.

---

## Step 1: Add Rust Dependencies

**File:** `crates/image-converter/Cargo.toml`

Add `kamadak-exif` and `png` as direct dependencies:

```toml
kamadak-exif = "0.6"
png = { version = "0.18", default-features = false }
```

`png` is already a transitive dependency of `image`; making it direct allows access to text chunk APIs. Use `default-features = false` to avoid pulling in unnecessary features.

**Verify:**
```bash
cargo check --manifest-path crates/image-converter/Cargo.toml
cargo tree --manifest-path crates/image-converter/Cargo.toml -d  # confirm no duplicate png versions
```

---

## Step 2: Create `metadata.rs` Module

**File:** `crates/image-converter/src/metadata.rs` (new)

### 2a: Define Data Structures

```rust
use serde::Serialize;

/// Metadata extracted from an image file.
#[derive(Debug, Clone, Serialize, Default)]
pub struct ImageMetadata {
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub color_type: String,
    pub bits_per_pixel: u16,
    pub has_alpha: bool,
    pub has_icc_profile: bool,
    pub exif: ExifData,
    pub png_text_chunks: Vec<TextChunk>,
}

/// Parsed EXIF data with curated fields and optional full field list.
#[derive(Debug, Clone, Serialize, Default)]
pub struct ExifData {
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub date_time: Option<String>,
    pub exposure_time: Option<String>,
    pub f_number: Option<String>,
    pub iso: Option<String>,
    pub focal_length: Option<String>,
    pub orientation: Option<String>,
    pub software: Option<String>,
    pub gps_latitude: Option<f64>,
    pub gps_longitude: Option<f64>,
    pub has_gps: bool,
    pub all_fields: Vec<ExifField>,
}

/// A single EXIF tag/value pair for the "all fields" view.
#[derive(Debug, Clone, Serialize)]
pub struct ExifField {
    pub tag: String,
    pub value: String,
    pub group: String,
}

/// A PNG text chunk (tEXt, zTXt, or iTXt).
#[derive(Debug, Clone, Serialize)]
pub struct TextChunk {
    pub keyword: String,
    pub text: String,
}
```

### 2b: Implement `extract()` Function

The main extraction function:

```rust
pub fn extract(input: &[u8]) -> Result<ImageMetadata, MetadataError> { ... }
```

Logic:
1. Use `ImageReader::new(Cursor::new(input)).with_guessed_format()` to detect format
2. Call `reader.into_decoder()` to get an `ImageDecoder` (no pixel decode)
3. Extract dimensions, color_type, icc_profile presence from the decoder
4. Extract raw EXIF bytes via `decoder.exif_metadata()`
5. If EXIF bytes exist, parse with `kamadak-exif::Reader::new().read_raw()`
6. Extract curated EXIF tags (Make, Model, DateTime, ExposureTime, FNumber, ISO, FocalLength, Orientation, Software)
7. Extract GPS coordinates — convert DMS Rational values to decimal degrees
8. Populate `all_fields` with all parsed EXIF fields
9. If format is PNG, extract text chunks using `png::Decoder` directly
10. Return populated `ImageMetadata` struct

### 2c: GPS Coordinate Conversion

Helper to convert EXIF GPS Rational values to decimal degrees:

```rust
fn rational_to_decimal_degrees(field: &exif::Field) -> Option<f64> { ... }
```

Uses `exif::Value::Rational` to extract degrees, minutes, seconds, then computes `degrees + minutes/60 + seconds/3600`. Apply sign based on `GPSLatitudeRef` (N/S) and `GPSLongitudeRef` (E/W).

### 2d: PNG Text Chunk Extraction

```rust
fn extract_png_text(input: &[u8]) -> Result<Vec<TextChunk>, MetadataError> { ... }
```

Uses `png::Decoder::new(Cursor::new(input))` then `read_info()` to get header info. Iterates `info.uncompressed_latin1_text`, `info.compressed_latin1_text` (via `get_text()`), and `info.utf8_text` (via `get_text()`).

### 2e: Error Type

```rust
#[derive(Debug)]
pub enum MetadataError {
    Io(std::io::Error),
    Decode(image::ImageError),
    ExifParse(String),
    PngParse(String),
}
```

With `Display` and `Error` implementations (following `ConvertError` pattern in `convert.rs`).

### 2f: Unit Tests

In a `#[cfg(test)] mod tests` block at the bottom of `metadata.rs`:

- **`extract_basic_metadata_from_png`** — Create a PNG with `make_png()`, verify width, height, format="png", has_alpha, bits_per_pixel
- **`extract_basic_metadata_from_jpeg`** — Create a JPEG, verify format="jpeg", no alpha
- **`extract_no_exif_returns_empty`** — Synthetic PNG/BMP/GIF should return `ExifData::default()` (empty exif, no GPS)
- **`extract_png_text_chunks`** — Build a PNG with text chunks using the `png` encoder, verify they are extracted correctly
- **`extract_icc_profile_detection`** — Test with/without ICC profile presence
- **`extract_empty_input_returns_error`** — Empty bytes should return `MetadataError`
- **`extract_invalid_bytes_returns_error`** — Random bytes should return error
- **`gps_rational_to_decimal`** — Unit test the decimal degrees conversion helper with known values

Note: Testing EXIF parsing from real JPEG with embedded EXIF is harder without a fixture file. For unit tests, we'll test the parse path with a synthetic EXIF blob using `kamadak-exif`'s test helpers if available, or test the no-EXIF path thoroughly and rely on E2E tests for real EXIF validation.

**Verify:**
```bash
cargo test --manifest-path crates/image-converter/Cargo.toml metadata
```

---

## Step 3: Register Module and Add WASM Export in `lib.rs`

**File:** `crates/image-converter/src/lib.rs`

Add:
```rust
pub mod metadata;
```

Add WASM export function:

```rust
/// Extract metadata from an image without fully decoding pixel data.
///
/// Returns a JavaScript object containing image dimensions, format, color info,
/// EXIF data (if present), and PNG text chunks (if applicable).
///
/// # Errors
///
/// Returns a `JsError` if the image format cannot be detected or metadata extraction fails.
#[wasm_bindgen]
pub fn get_image_metadata(input: &[u8]) -> Result<JsValue, JsError> {
    let meta = metadata::extract(input)
        .map_err(|e| JsError::new(&e.to_string()))?;
    serde_wasm_bindgen::to_value(&meta)
        .map_err(|e| JsError::new(&format!("Failed to serialize metadata: {e}")))
}
```

This follows the exact same pattern as `get_dimensions`.

**Verify:**
```bash
cargo test --manifest-path crates/image-converter/Cargo.toml
cargo clippy --manifest-path crates/image-converter/Cargo.toml -- -D warnings
cargo fmt --manifest-path crates/image-converter/Cargo.toml -- --check
```

---

## Step 4: Build WASM

```bash
wasm-pack build crates/image-converter --target web --release
```

Verify the generated `pkg/image_converter.js` exports `get_image_metadata`.

---

## Step 5: Add TypeScript Types for Metadata

**File:** `web/src/types/interfaces.ts`

Add metadata-related interfaces and worker message types:

```typescript
/** Metadata extracted from an image by the WASM module. */
export interface ImageMetadata {
  width: number
  height: number
  format: string
  color_type: string
  bits_per_pixel: number
  has_alpha: boolean
  has_icc_profile: boolean
  exif: ExifData
  png_text_chunks: TextChunk[]
}

export interface ExifData {
  camera_make: string | null
  camera_model: string | null
  date_time: string | null
  exposure_time: string | null
  f_number: string | null
  iso: string | null
  focal_length: string | null
  orientation: string | null
  software: string | null
  gps_latitude: number | null
  gps_longitude: number | null
  has_gps: boolean
  all_fields: ExifField[]
}

export interface ExifField {
  tag: string
  value: string
  group: string
}

export interface TextChunk {
  keyword: string
  text: string
}
```

Add worker request/response interfaces:

```typescript
export interface GetMetadataRequest {
  type: MessageType.GetMetadata
  id: number
  data: Uint8Array
}

export interface GetMetadataSuccessResponse {
  type: MessageType.GetMetadata
  id: number
  success: true
  metadata: ImageMetadata
}
```

**File:** `web/src/types/enums.ts`

Add `GetMetadata = 'get_metadata'` to `MessageType` enum.

**File:** `web/src/types/types.ts`

Add `GetMetadataRequest` to `WorkerRequest` union and `GetMetadataSuccessResponse` to `WorkerResponse` union.

**Verify:**
```bash
cd web && npx tsc --noEmit
```

---

## Step 6: Add Metadata to Web Worker

**File:** `web/src/worker.ts`

1. Import `get_image_metadata` from the WASM package
2. Add `MessageType.GetMetadata` case to the `onmessage` switch
3. Implement `handleGetMetadata(id, data)`:

```typescript
function handleGetMetadata(id: number, data: Uint8Array): void {
  try {
    const raw = get_image_metadata(data)
    const metadata = raw as ImageMetadata
    const response: WorkerResponse = {
      type: MessageType.GetMetadata,
      id,
      success: true,
      metadata,
    }
    postMessage(response)
  } catch (e) {
    postError(id, e)
  }
}
```

The `get_image_metadata` WASM function returns a `JsValue` via `serde_wasm_bindgen::to_value()`, which is already a plain JS object matching the `ImageMetadata` shape.

**Verify:**
```bash
cd web && npx tsc --noEmit
```

---

## Step 7: Add `getMetadata()` to `ImageConverter` Class

**File:** `web/src/lib/image-converter.ts`

Add method:

```typescript
/** Extract image metadata without fully decoding pixel data. */
async getMetadata(data: Uint8Array): Promise<ImageMetadata> {
  await this.ready
  const id = this.nextRequestId++
  const response = await this.sendRequest({ type: MessageType.GetMetadata, id, data })
  if (response.type === MessageType.GetMetadata) {
    return response.metadata
  }
  throw new Error('Unexpected response type')
}
```

Import `ImageMetadata` type from `../types`.

**Verify:**
```bash
cd web && npx tsc --noEmit
```

---

## Step 8: Extract Metadata on File Load

**File:** `web/src/hooks/useConverter.ts`

### 8a: Add `metadata` to `FileInfo`

```typescript
export interface FileInfo {
  file: File
  bytes: Uint8Array
  sourceFormat: ValidFormat
  megapixels: number
  width: number
  height: number
  metadata: ImageMetadata | null  // NEW
}
```

### 8b: Fetch Metadata in `handleFile`

In the `handleFile` function, after the existing `Promise.all([detectFormat, getDimensions])` call, add a metadata extraction call. Extract it alongside format and dimensions in the same `Promise.all`:

```typescript
const [format, dimensions, metadata] = await Promise.all([
  converter.detectFormat(bytes),
  converter.getDimensions(bytes),
  converter.getMetadata(bytes),
])
```

Set `metadata` in the `FileInfo` object stored in state. If metadata extraction fails, catch the error and set `metadata: null` (non-blocking — file load should still succeed even if metadata extraction fails). To do this, wrap the metadata call:

```typescript
const metadataPromise = converter.getMetadata(bytes).catch((err: unknown) => {
  console.warn('[image-converter] Metadata extraction failed:', err)
  return null
})

const [format, dimensions, metadata] = await Promise.all([
  converter.detectFormat(bytes),
  converter.getDimensions(bytes),
  metadataPromise,
])
```

**Verify:**
```bash
cd web && npx tsc --noEmit
```

---

## Step 9: Create MetadataPanel Component

**File:** `web/src/components/MetadataPanel.tsx` (new)

A collapsible panel using native HTML `<details>/<summary>` elements that displays image metadata in sections:

### Sections:

1. **Basic Info** (always shown, open by default):
   - Format, dimensions, color type, bits per pixel, alpha channel, ICC profile

2. **EXIF Data** (shown when `exif.all_fields.length > 0`):
   - Curated fields first: Camera (make + model), Date, Exposure, f/, ISO, Focal Length, Orientation, Software
   - "Show all fields" toggle that reveals the full `all_fields` table
   - GPS warning/info if `has_gps` is true — display decimal degrees

3. **PNG Text Chunks** (shown when `png_text_chunks.length > 0`):
   - Table of keyword/text pairs

### Design Approach:

- Use inline styles consistent with the cyberpunk theme (matching existing components like `ResultStats`, `BenchmarkTable`)
- Use CSS custom properties (`var(--cp-*)`) for colors
- Use `Share Tech Mono` font, monospace styling
- Compact table layout with left-aligned labels in muted color, values in primary text color
- GPS coordinates displayed as `37.7749° N, 122.4194° W` with a subtle warning about location data

### Props:

```typescript
interface MetadataPanelProps {
  metadata: ImageMetadata | null
}
```

Returns `null` if metadata is null (no file loaded yet).

**Verify:**
```bash
cd web && npx tsc --noEmit
```

---

## Step 10: Integrate MetadataPanel into ImageConverter

**File:** `web/src/components/ImageConverter.tsx`

Import `MetadataPanel` and render it inside the main section, after the `DropZone` and before the `BenchmarkTable`:

```tsx
<MetadataPanel metadata={state.fileInfo?.metadata ?? null} />
```

The panel auto-shows when a file is loaded (since `metadata` is populated in `FileInfo`), and hides when no file is loaded.

**Verify:**
```bash
cd web && npm run dev  # Visual inspection
cd web && npx tsc --noEmit
```

---

## Step 11: Add Analytics Event

**File:** `web/src/analytics.ts`

Add a `trackMetadataViewed` event (fired when user expands the EXIF or PNG text chunk sections):

```typescript
export function trackMetadataViewed(props: {
  source_format: string
  has_exif: boolean
  has_gps: boolean
  has_png_text: boolean
  exif_field_count: number
}): void {
  capture('metadata_viewed', props)
}
```

Wire this up in `MetadataPanel` — call it once when any `<details>` section is toggled open (use `onToggle` event on the `<details>` element).

**Verify:**
```bash
cd web && npx tsc --noEmit
```

---

## Step 12: Rust Lint and Format Pass

```bash
cargo fmt --manifest-path crates/image-converter/Cargo.toml
cargo clippy --manifest-path crates/image-converter/Cargo.toml -- -D warnings
```

Key things to watch for:
- `clippy::as_conversions` is denied — use `u16::from()`, `.try_into()`, or `#[allow(clippy::as_conversions)]` with safety comment where needed (e.g., bits_per_pixel from `ColorType`)
- `clippy::unwrap_used` / `clippy::expect_used` are denied — use `?` or `.ok()`
- `clippy::indexing_slicing` is denied — use `.get()` instead

---

## Step 13: TypeScript Lint and Format Pass

```bash
cd web && npm run check:all
```

Key things to watch for:
- `exactOptionalPropertyTypes` — use spread syntax for optional properties
- `noUncheckedIndexedAccess` — array access returns `T | undefined`
- No `any` types
- JSDocs on all functions

---

## Step 14: Unit Tests (TypeScript)

**File:** `web/tests/unit/metadata-panel.test.ts` (new)

Test the `MetadataPanel` component:

- **`renders null when metadata is null`** — returns null
- **`renders basic info section`** — format, dimensions, color type visible
- **`renders EXIF section when exif fields present`** — curated fields displayed
- **`hides EXIF section when no exif data`** — no details/summary for EXIF
- **`displays GPS coordinates with warning`** — decimal degrees shown, warning text present
- **`renders PNG text chunks`** — keyword/text pairs visible
- **`renders all-fields toggle`** — clicking "show all" reveals full EXIF table

Use the existing test patterns from `web/tests/unit/` (Node environment, mock objects per memory notes about jsdom issues).

**Verify:**
```bash
cd web && npx vitest run
```

---

## Step 15: E2E Test

**File:** `web/tests/e2e/metadata.spec.ts` (new)

- **`shows basic metadata after uploading PNG`** — upload a PNG, verify metadata panel shows dimensions, format, color type
- **`shows no EXIF section for PNG without EXIF`** — verify EXIF section is absent for synthetic PNG

Note: Testing with real EXIF data in E2E requires a fixture JPEG with known EXIF. If feasible, add a small test fixture JPEG (can be a 1x1 JPEG with injected EXIF headers). Otherwise, test the no-EXIF path which covers the UI rendering logic.

**Verify:**
```bash
cd web && npx playwright test metadata
```

---

## Verification Checklist

Run all checks to confirm the feature is complete:

```bash
# Rust
cargo test --manifest-path crates/image-converter/Cargo.toml
cargo fmt --manifest-path crates/image-converter/Cargo.toml -- --check
cargo clippy --manifest-path crates/image-converter/Cargo.toml -- -D warnings

# WASM build
wasm-pack build crates/image-converter --target web --release

# TypeScript
cd web && npm run check:all  # typecheck + lint + format

# Unit tests
cd web && npx vitest run

# E2E tests
cd web && npx playwright test

# Dev server smoke test
cd web && npm run dev  # Load an image, verify metadata panel appears
```

---

## File Summary

| Action | File |
|--------|------|
| Edit | `crates/image-converter/Cargo.toml` — add kamadak-exif, png deps |
| New | `crates/image-converter/src/metadata.rs` — metadata extraction module |
| Edit | `crates/image-converter/src/lib.rs` — add `mod metadata` + `get_image_metadata` export |
| Edit | `web/src/types/enums.ts` — add `GetMetadata` to `MessageType` |
| Edit | `web/src/types/interfaces.ts` — add metadata interfaces + request/response types |
| Edit | `web/src/types/types.ts` — add to union types |
| Edit | `web/src/worker.ts` — import + handle `GetMetadata` message |
| Edit | `web/src/lib/image-converter.ts` — add `getMetadata()` method |
| Edit | `web/src/hooks/useConverter.ts` — add `metadata` to `FileInfo`, fetch on load |
| New | `web/src/components/MetadataPanel.tsx` — collapsible metadata display |
| Edit | `web/src/components/ImageConverter.tsx` — render `MetadataPanel` |
| Edit | `web/src/analytics.ts` — add `trackMetadataViewed` event |
| New | `web/tests/unit/metadata-panel.test.ts` — component unit tests |
| New | `web/tests/e2e/metadata.spec.ts` — E2E tests |

## Risks & Mitigations

- **`image` crate `ImageDecoder::exif_metadata()` API**: Added in v0.25.4, current version is 0.25.9. Verified via docs. If the API shape differs, fall back to full `load_from_memory` + manual EXIF extraction from the image crate's lower-level APIs.
- **kamadak-exif `read_raw()` API**: Verified in docs for v0.6.x. The `Reader::new().read_raw(bytes)` pattern replaces the old `Reader::new(data)` constructor.
- **PNG text chunk encoding**: The `png` crate handles Latin-1 → String conversion internally. Always use `get_text()` methods, never raw byte access.
- **Large EXIF blobs**: Curated tags are extracted first; `all_fields` is populated but only rendered on toggle. No performance concern.
- **GPS privacy**: GPS data is displayed locally in the browser, never sent to any server. The analytics event tracks `has_gps: boolean` only, not the actual coordinates.
