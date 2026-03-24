# Image Metadata + EXIF Display - Research

**Researched:** 2026-03-19
**Domain:** Rust/WASM image metadata extraction, Preact UI
**Confidence:** HIGH

## Summary

The project's existing `image` crate (v0.25.9) already provides substantial metadata extraction capabilities through the `ImageDecoder` trait, including `exif_metadata()`, `icc_profile()`, `xmp_metadata()`, `iptc_metadata()`, and `orientation()`. These were added progressively in v0.25.4 through v0.25.9. This means the "raw bytes" extraction layer is already available with zero new dependencies.

For parsing raw EXIF bytes into human-readable fields (camera model, exposure, GPS coordinates, etc.), `kamadak-exif` (v0.6.1) is the clear choice. It is pure Rust (WASM-compatible), supports `read_raw()` for parsing pre-extracted EXIF buffers, and is the most mature EXIF parsing crate in the Rust ecosystem. The architecture is: `image` crate extracts raw EXIF bytes via `ImageDecoder::exif_metadata()` -> `kamadak-exif` parses them into structured fields -> `serde_wasm_bindgen::to_value()` serializes to JS.

PNG text chunks (tEXt/zTXt/iTXt) are NOT exposed by the `image` crate's `ImageDecoder` trait. Accessing them requires using the `png` crate directly (v0.18.1, already a transitive dependency). This adds modest complexity but is achievable by creating a `PngDecoder` from bytes when the format is detected as PNG.

**Primary recommendation:** Add `kamadak-exif = "0.6"` as the sole new Rust dependency. Use the `image` crate's existing `ImageDecoder` trait for raw metadata extraction (EXIF, ICC, XMP, IPTC). Use `kamadak-exif` to parse EXIF bytes into structured fields. For PNG text chunks, add `png = "0.18"` as a direct dependency (already transitive). Return metadata as a `#[derive(Serialize)]` struct via `serde_wasm_bindgen::to_value()`, matching the existing `get_dimensions` pattern.

## Standard Stack

### Core

| Library | Version | Purpose | License | Maintained? | Why Standard |
| --- | --- | --- | --- | --- | --- |
| image | 0.25.9 | Raw metadata extraction (EXIF, ICC, XMP, IPTC bytes) via `ImageDecoder` | MIT/Apache-2.0 | Yes | Already a dependency; `exif_metadata()` added in 0.25.4 |
| kamadak-exif | 0.6.1 | Parse raw EXIF bytes into structured fields (tags, values) | BSD-2-Clause | Yes (last release ~2024) | Pure Rust, only EXIF parser with `read_raw()` for pre-extracted bytes, broadest format support |
| png | 0.18.1 | PNG text chunk extraction (tEXt/zTXt/iTXt) | MIT/Apache-2.0 | Yes (part of image-rs) | Already transitive dep; only way to access PNG text metadata |

### Supporting

| Library | Version | Purpose | When to Use |
| --- | --- | --- | --- |
| serde + serde-wasm-bindgen | 1.x / 0.6 | Serialize metadata struct to JsValue | Already in project; use for all metadata return values |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
| --- | --- | --- |
| kamadak-exif | nom-exif | nom-exif has lazy parsing and video support, but less community adoption, no clear `read_raw()` equivalent for pre-extracted bytes, and adds `nom` as a dependency |
| kamadak-exif | rexif | Only supports JPEG/TIFF (no PNG/WebP EXIF), self-described as "early stages" |
| png crate for text chunks | Skip PNG text chunks | Simpler, but loses metadata for PNG files which is a primary format in this app |
| kamadak-exif for EXIF | JS-side EXIF parsing (exif-js, exifr) | Keeps Rust side simpler but duplicates parsing logic, adds JS bundle size, and breaks the "all processing in WASM" pattern |

**Installation:**
```bash
# In crates/image-converter/Cargo.toml, add:
kamadak-exif = "0.6"
png = "0.18"  # Already transitive, making it direct for text chunk access
```

## Architecture Options

| Option | Description | Pros | Cons | Best When |
| --- | --- | --- | --- | --- |
| A: All-in-WASM | Extract + parse all metadata in Rust, return structured object to JS | Single boundary crossing, consistent with project pattern, typed end-to-end | Slightly larger WASM binary (~50-80KB for kamadak-exif) | Project already follows this pattern; recommended |
| B: Hybrid | Extract raw bytes in WASM, parse in JS using exifr/exif-js | Smaller WASM binary, mature JS EXIF libraries | Two boundary crossings for EXIF, mixed responsibility, adds JS dependency | If WASM binary size is critical constraint |
| C: image-only | Only use `image` crate's `ImageDecoder` trait, skip detailed EXIF parsing | Zero new Rust dependencies | Only gets raw bytes, no parsed fields (camera, GPS, etc.), PNG text chunks still need `png` crate | If only ICC profile presence and basic color info needed |

**Recommended:** Option A (All-in-WASM) -- consistent with project's existing pattern where all image processing happens in Rust/WASM. The `get_dimensions` and `convert_image` functions already follow this approach.

### Counterarguments

- **WASM binary size increase:** kamadak-exif adds ~50-80KB to the binary. **Response:** The project already includes 9 image codecs; EXIF parsing is a fraction of that. Binary is already optimized with `opt-level = "s"` and LTO.
- **kamadak-exif maintenance concerns (single maintainer):** **Response:** The crate is stable and feature-complete for reading. EXIF is a standardized format that rarely changes. The `read_raw()` path we use is simple and unlikely to break. If maintenance stops, we only need basic tag parsing which could be inlined.

## Architecture Patterns

### Recommended Project Structure

```
crates/image-converter/src/
  lib.rs          # Add get_image_metadata() WASM export
  metadata.rs     # New: metadata extraction + EXIF parsing logic
  convert.rs      # Existing (unchanged)
  formats.rs      # Existing (unchanged)
  transforms.rs   # Existing (unchanged)
```

### Pattern 1: Metadata Extraction via ImageDecoder

**What:** Use `ImageReader::new(Cursor::new(bytes)).with_guessed_format()?.into_decoder()?` to get an `ImageDecoder`, then call metadata methods before decoding pixels.

**When to use:** For all metadata extraction -- this avoids full pixel decode.

**Example:**
```rust
// Source: https://docs.rs/image/0.25.9/image/trait.ImageDecoder.html
use std::io::Cursor;
use image::ImageReader;

pub fn extract_basic_metadata(input: &[u8]) -> Result<BasicMetadata, MetadataError> {
    let reader = ImageReader::new(Cursor::new(input))
        .with_guessed_format()
        .map_err(|e| MetadataError::Io(e))?;

    let format = reader.format();
    let decoder = reader.into_decoder()
        .map_err(MetadataError::Decode)?;

    let (width, height) = decoder.dimensions();
    let color_type = decoder.color_type();
    let original_color_type = decoder.original_color_type();
    let icc_profile = decoder.icc_profile();
    let raw_exif = decoder.exif_metadata();
    let orientation = decoder.orientation();

    // ... build struct
}
```

### Pattern 2: EXIF Parsing with kamadak-exif read_raw

**What:** Parse pre-extracted raw EXIF bytes (from `ImageDecoder::exif_metadata()`) using `exif::Reader::new().read_raw()`.

**When to use:** When you have raw EXIF bytes and need structured tag/value pairs.

**Example:**
```rust
// Source: https://docs.rs/kamadak-exif/0.6.1/exif/struct.Reader.html
use exif::{Reader, Tag, In};

fn parse_exif_fields(raw_exif: Vec<u8>) -> Result<Vec<ExifField>, MetadataError> {
    let exif_data = Reader::new()
        .read_raw(raw_exif)
        .map_err(|e| MetadataError::ExifParse(e.to_string()))?;

    let mut fields = Vec::new();
    for f in exif_data.fields() {
        fields.push(ExifField {
            tag: f.tag.to_string(),
            ifd_num: format!("{}", f.ifd_num),
            value: f.display_value().with_unit(&exif_data).to_string(),
        });
    }

    // Common specific tags:
    if let Some(field) = exif_data.get_field(Tag::Make, In::PRIMARY) {
        // Camera manufacturer
    }
    if let Some(field) = exif_data.get_field(Tag::Model, In::PRIMARY) {
        // Camera model
    }

    Ok(fields)
}
```

### Pattern 3: PNG Text Chunk Extraction

**What:** Use the `png` crate's `Decoder` directly to read tEXt/zTXt/iTXt chunks.

**When to use:** Only when format is detected as PNG.

**Example:**
```rust
// Source: https://docs.rs/png/0.18.1/png/text_metadata/index.html
use std::io::Cursor;

fn extract_png_text_chunks(input: &[u8]) -> Result<Vec<TextChunk>, MetadataError> {
    let decoder = png::Decoder::new(Cursor::new(input));
    let reader = decoder.read_info()
        .map_err(|e| MetadataError::PngParse(e.to_string()))?;
    let info = reader.info();

    let mut chunks = Vec::new();

    for chunk in &info.uncompressed_latin1_text {
        chunks.push(TextChunk {
            keyword: chunk.keyword.clone(),
            text: chunk.text.clone(),
        });
    }
    for chunk in &info.compressed_latin1_text {
        if let Ok(text) = chunk.get_text() {
            chunks.push(TextChunk {
                keyword: chunk.keyword.clone(),
                text,
            });
        }
    }
    for chunk in &info.utf8_text {
        if let Ok(text) = chunk.get_text() {
            chunks.push(TextChunk {
                keyword: chunk.keyword.clone(),
                text,
            });
        }
    }

    Ok(chunks)
}
```

### Pattern 4: Returning Structured Metadata to JS

**What:** Use `#[derive(Serialize)]` struct with `serde_wasm_bindgen::to_value()`, matching the existing `get_dimensions` pattern in `lib.rs`.

**When to use:** For the WASM export function.

**Example:**
```rust
use serde::Serialize;

#[derive(Serialize)]
pub struct ImageMetadata {
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub color_type: String,
    pub bits_per_pixel: u16,
    pub has_alpha: bool,
    pub has_icc_profile: bool,
    pub orientation: Option<u8>,
    pub exif_fields: Vec<ExifField>,
    pub text_chunks: Vec<TextChunk>,  // PNG only
}

#[derive(Serialize)]
pub struct ExifField {
    pub tag: String,
    pub value: String,
    pub group: String,  // "Primary", "Thumbnail", "GPS", etc.
}

#[derive(Serialize)]
pub struct TextChunk {
    pub keyword: String,
    pub text: String,
}

// In lib.rs:
#[wasm_bindgen]
pub fn get_image_metadata(input: &[u8]) -> Result<JsValue, JsError> {
    let metadata = metadata::extract(input)
        .map_err(|e| JsError::new(&e.to_string()))?;
    serde_wasm_bindgen::to_value(&metadata)
        .map_err(|e| JsError::new(&format!("Failed to serialize metadata: {e}")))
}
```

### Anti-Patterns to Avoid

- **Returning `HashMap<String, String>`:** Loses type safety, makes TS consumption harder, forces string coercion for numeric values. Use typed structs with `#[derive(Serialize)]`.
- **Full pixel decode for metadata only:** Using `image::load_from_memory()` decodes all pixels. Use `ImageReader::into_decoder()` + metadata methods instead -- much faster and lower memory.
- **Using `Reader::read_from_container` with full image bytes:** This re-parses the container format. Since `image` crate already extracts raw EXIF bytes, use `Reader::read_raw()` to avoid double-parsing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
| --- | --- | --- | --- |
| EXIF tag parsing | Manual IFD/tag parser | kamadak-exif | EXIF has complex nested IFDs, rational number types, byte order variations, maker notes -- deceptively complex |
| GPS coordinate extraction | Manual lat/lon conversion from EXIF rationals | kamadak-exif's `Tag::GPSLatitude` + `Tag::GPSLatitudeRef` with value display | GPS encoding uses degrees/minutes/seconds as Rational values with N/S/E/W references |
| PNG text chunk decompression | Manual zlib inflate for zTXt | png crate's `ZTXtChunk::get_text()` | Handles decompression, encoding, and edge cases |

## Common Pitfalls

### Pitfall 1: EXIF Data May Not Exist

**What goes wrong:** Assuming all images have EXIF data; crashing or showing empty UI when `exif_metadata()` returns `None`.
**Why it happens:** PNGs from web tools, BMPs, GIFs, and synthetic images rarely have EXIF. Only photos from cameras/phones reliably have it.
**How to avoid:** Make every EXIF field `Option<T>`. Return a metadata struct that gracefully represents "no EXIF data" with empty vectors/None values. UI should show "No EXIF data" rather than an empty table.

### Pitfall 2: EXIF Orientation vs. Displayed Orientation

**What goes wrong:** Showing "Orientation: Rotate 90 CW" in metadata while the preview shows the image unrotated (or vice versa).
**Why it happens:** The `image` crate's `load_from_memory` does NOT apply EXIF orientation. The app may or may not apply it via transforms.
**How to avoid:** Display the raw orientation value as metadata. If the app applies orientation correction, note that in the UI. The `ImageDecoder::orientation()` method returns the orientation without needing full EXIF parsing.

### Pitfall 3: Large EXIF Blobs

**What goes wrong:** Some camera images embed thumbnails and maker notes in EXIF, producing 50KB+ of raw EXIF data. Parsing and serializing all of it is wasteful.
**Why it happens:** EXIF spec allows arbitrary manufacturer-specific data.
**How to avoid:** Filter to well-known tags (camera model, exposure, ISO, GPS, date, software) rather than serializing every field. Use `kamadak-exif`'s specific `Tag::*` constants to pick what to include.

### Pitfall 4: PNG Text Chunk Encoding

**What goes wrong:** Garbled text from tEXt chunks displayed in the UI.
**Why it happens:** tEXt/zTXt use Latin-1 (ISO 8859-1), not UTF-8. Only iTXt is UTF-8.
**How to avoid:** The `png` crate handles encoding conversion internally via `get_text()`. Always use the crate's methods rather than reading raw bytes as UTF-8.

### Pitfall 5: Memory Doubling During Metadata Extraction

**What goes wrong:** OOM in WASM when extracting metadata from large images.
**Why it happens:** Creating an `ImageReader` + `into_decoder()` may buffer the input. If the caller also holds the input bytes, memory doubles.
**How to avoid:** The current `get_dimensions` pattern already takes `&[u8]` (borrowed) which is correct. The `ImageDecoder` from `into_decoder()` borrows the cursor, not the bytes. Keep the metadata function signature as `fn get_image_metadata(input: &[u8])` to avoid unnecessary copies.

## Security

### Known Vulnerabilities

| Library | CVE / Advisory | Severity | Status | Action |
| --- | --- | --- | --- | --- |
| kamadak-exif | CVE-2021-21235 (infinite loop in PNG parsing) | MEDIUM (6.5) | Patched in v0.5.3 | Use v0.6.1 (current) |
| image | None found | -- | -- | Continue using v0.25.9 |
| png | None found for v0.18.x | -- | -- | Continue using v0.18.1 |

### Architectural Security Risks

| Risk | Affected Architecture Options | How It Manifests | Secure Pattern | Anti-Pattern to Avoid |
| --- | --- | --- | --- | --- |
| Malicious EXIF data causing DoS | All options | Crafted EXIF with deep nesting or circular references causes excessive parsing time | Use `kamadak-exif` v0.6.1+ (patched), set parsing timeouts if possible | Parsing untrusted EXIF data with unpatched libraries |
| EXIF data leaking user location | All options | GPS coordinates displayed to user (which is desired) but also sent to analytics or logged | Only display GPS data in the UI; never send metadata to server-side analytics | Logging or transmitting raw EXIF data server-side |
| XSS via EXIF text fields | All options | EXIF `UserComment`, `ImageDescription`, or PNG text chunks may contain HTML/script | Always escape metadata values before rendering in DOM. Preact's JSX auto-escapes by default -- do NOT use `dangerouslySetInnerHTML` for metadata | Rendering raw metadata strings as HTML |

### Trust Boundaries

- **File upload input:** User-provided image bytes are untrusted. The `image` crate's decoder validates format before metadata extraction. `kamadak-exif` validates EXIF structure. Both handle malformed input with `Result::Err`.
- **EXIF string values:** Metadata text fields (comments, descriptions) are untrusted user-controlled strings. Preact's JSX escapes them automatically when rendered as text content.

## Performance

| Metric | Value / Range | Source | Notes |
| --- | --- | --- | --- |
| EXIF extraction (no pixel decode) | ~1-5ms for typical JPEG | Estimated from `into_decoder()` + `exif_metadata()` path | Header-only parsing, no pixel decode |
| EXIF parsing (kamadak-exif read_raw) | <1ms for typical EXIF blob | Estimated; pure CPU parsing of ~10-50KB blob | Much faster than full image decode |
| WASM binary size increase | ~50-80KB (kamadak-exif) | Estimated; pure Rust crate with one dependency (mutate_once) | With LTO and opt-level=s |
| PNG text chunk extraction | ~1-3ms | Estimated from png decoder header read | Only reads header + text chunks, not pixel data |

_Note: No published benchmarks found for kamadak-exif WASM performance. Flag for validation during implementation._

## Code Examples

### Complete Metadata Extraction Function (Recommended Pattern)

```rust
// Combines all patterns into the recommended implementation approach
use std::io::Cursor;
use image::ImageReader;
use serde::Serialize;

#[derive(Serialize, Default)]
pub struct ImageMetadata {
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub color_type: String,
    pub bits_per_pixel: u16,
    pub has_alpha: bool,
    pub has_icc_profile: bool,
    pub exif: Vec<ExifEntry>,
    pub text_chunks: Vec<TextEntry>,
}

#[derive(Serialize)]
pub struct ExifEntry {
    pub tag: String,
    pub value: String,
}

#[derive(Serialize)]
pub struct TextEntry {
    pub keyword: String,
    pub text: String,
}

pub fn extract(input: &[u8]) -> Result<ImageMetadata, MetadataError> {
    let reader = ImageReader::new(Cursor::new(input))
        .with_guessed_format()
        .map_err(|e| MetadataError::Io(e))?;

    let detected_format = reader.format();
    let decoder = reader.into_decoder()
        .map_err(MetadataError::Decode)?;

    let (width, height) = decoder.dimensions();
    let color_type = decoder.color_type();
    let has_icc = decoder.icc_profile().is_some();

    // Extract raw EXIF and parse with kamadak-exif
    let exif_entries = match decoder.exif_metadata() {
        Some(raw_exif) => parse_exif(raw_exif)?,
        None => Vec::new(),
    };

    // PNG text chunks (format-specific)
    let text_chunks = if matches!(detected_format, Some(image::ImageFormat::Png)) {
        extract_png_text(input)?
    } else {
        Vec::new()
    };

    Ok(ImageMetadata {
        width,
        height,
        format: detected_format.map_or_else(|| "unknown".into(), |f| format!("{f:?}").to_lowercase()),
        color_type: format!("{color_type:?}"),
        bits_per_pixel: color_type.bits_per_pixel(),
        has_alpha: color_type.has_alpha(),
        has_icc_profile: has_icc,
        exif: exif_entries,
        text_chunks,
    })
}
```

### Frontend: Collapsible Metadata Panel (Preact)

```tsx
// Use native HTML <details>/<summary> for zero-dependency collapsible sections
// Styled with Tailwind CSS v4 (project's existing setup)
import { useState } from 'preact/hooks'

interface MetadataPanelProps {
  metadata: ImageMetadata | null
}

/** Collapsible panel displaying image metadata in grouped sections. */
export function MetadataPanel({ metadata }: MetadataPanelProps): preact.JSX.Element | null {
  if (!metadata) return null

  return (
    <div class="space-y-2">
      <details open>
        <summary class="cursor-pointer font-semibold">Basic Info</summary>
        <table class="w-full text-sm">
          <tbody>
            <tr><td class="pr-4 text-gray-500">Dimensions</td><td>{metadata.width} x {metadata.height}</td></tr>
            <tr><td class="pr-4 text-gray-500">Format</td><td>{metadata.format}</td></tr>
            <tr><td class="pr-4 text-gray-500">Color Type</td><td>{metadata.color_type}</td></tr>
            <tr><td class="pr-4 text-gray-500">Bits/Pixel</td><td>{metadata.bits_per_pixel}</td></tr>
          </tbody>
        </table>
      </details>

      {metadata.exif.length > 0 && (
        <details>
          <summary class="cursor-pointer font-semibold">EXIF Data</summary>
          <table class="w-full text-sm">
            <tbody>
              {metadata.exif.map((entry) => (
                <tr key={entry.tag}>
                  <td class="pr-4 text-gray-500">{entry.tag}</td>
                  <td>{entry.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
| --- | --- | --- | --- |
| Full image decode to get metadata | `ImageDecoder` trait with `exif_metadata()`, `icc_profile()`, etc. | image crate v0.25.4 (2024) | Metadata extraction without pixel decode -- much faster |
| Manual EXIF container parsing | `image` crate extracts raw EXIF + `kamadak-exif` parses fields | image v0.25.4+ | No need to handle JPEG APP1 markers, PNG eXIf chunks, etc. manually |
| `serde_json` for WASM data transfer | `serde-wasm-bindgen` for direct JS value creation | serde-wasm-bindgen v0.4+ | Avoids JSON string intermediate; creates JS objects directly |

**Deprecated/outdated:**

- **`kamadak-exif` `Reader::new(data)` constructor:** Replaced by `Reader::new().read_raw(data)` in v0.6. The old API no longer compiles.
- **`JsValue::from_serde()`:** Deprecated in wasm-bindgen; use `serde_wasm_bindgen::to_value()` instead (project already does this).

## Validation Architecture

### Test Framework

| Property | Value |
| --- | --- |
| Rust unit tests | `cargo test --manifest-path crates/image-converter/Cargo.toml` |
| WASM tests | `wasm-pack test --headless --chrome` |
| Vitest (unit) | `cd web && npx vitest run` |
| Playwright (e2e) | `cd web && npx playwright test` |
| Config files | `web/vitest.config.ts`, Cargo.toml test config |

### Requirements to Test Map

| Requirement | Behavior | Test Type | Automated Command | File Exists? |
| --- | --- | --- | --- | --- |
| EXIF extraction from JPEG | Returns parsed EXIF fields from JPEG with EXIF data | unit (Rust) | `cargo test metadata` | Needs creating: `metadata.rs` tests |
| EXIF extraction from PNG | Returns EXIF fields if PNG contains eXIf chunk | unit (Rust) | `cargo test metadata` | Needs creating |
| EXIF extraction from WebP | Returns EXIF fields from WebP with EXIF | unit (Rust) | `cargo test metadata` | Needs creating |
| No-EXIF graceful fallback | Returns empty exif vec for BMP/GIF/images without EXIF | unit (Rust) | `cargo test metadata` | Needs creating |
| PNG text chunk extraction | Returns tEXt/zTXt/iTXt keyword-value pairs | unit (Rust) | `cargo test metadata` | Needs creating |
| Basic metadata (dimensions, color type) | Returns width, height, color_type, bits_per_pixel | unit (Rust) | `cargo test metadata` | Needs creating |
| ICC profile detection | Reports has_icc_profile=true when present | unit (Rust) | `cargo test metadata` | Needs creating |
| WASM export returns JsValue | `get_image_metadata` returns valid serialized object | wasm (browser) | `wasm-pack test --headless --chrome` | Needs creating |
| Frontend metadata display | MetadataPanel renders EXIF table | unit (Vitest) | `cd web && npx vitest run` | Needs creating: `web/tests/unit/metadata-panel.test.ts` |
| E2E metadata visibility | Upload JPEG, metadata panel shows camera info | e2e (Playwright) | `cd web && npx playwright test` | Needs creating: `web/tests/e2e/metadata.spec.ts` |

### Gaps (files to create before implementation)

- [ ] `crates/image-converter/src/metadata.rs` -- metadata extraction module with `#[cfg(test)]` tests
- [ ] `web/tests/unit/metadata-panel.test.ts` -- MetadataPanel component unit tests
- [ ] `web/tests/e2e/metadata.spec.ts` -- E2E test for metadata display after image upload
- [ ] Test fixture: a small JPEG with known EXIF data (camera, GPS, date) for deterministic assertions
- [ ] Test fixture: a small PNG with tEXt chunks for text chunk extraction tests

## Open Questions

1. **Which EXIF tags to display?**
   - What we know: EXIF can contain hundreds of tags including obscure maker notes. Displaying all is noisy.
   - What's unclear: Which tags are most useful for this app's users (photographers vs. web developers vs. general users).
   - Recommendation: Start with a curated list: Camera Make/Model, Date/Time, Exposure Time, F-Number, ISO, Focal Length, GPS Coordinates, Image Software, Orientation. Allow expanding to "all fields" via UI toggle.

2. **Should metadata be extracted automatically on file load or on-demand?**
   - What we know: Metadata extraction without pixel decode is fast (~1-5ms). Current file load already calls `get_dimensions` and `detect_format`.
   - What's unclear: Whether combining metadata extraction with the existing file-load flow is better than a separate button/action.
   - Recommendation: Extract metadata automatically on file load alongside dimensions. The cost is negligible and avoids an extra user action.

3. **GPS coordinate display format**
   - What we know: EXIF stores GPS as degrees/minutes/seconds Rationals. kamadak-exif's `display_value()` renders them as rational tuples.
   - What's unclear: Whether to show DMS format, decimal degrees, or a map link.
   - Recommendation: Show decimal degrees (e.g., "37.7749, -122.4194") which is universally understood. Consider a Google Maps link as a future enhancement.

4. **PNG `png` crate version alignment**
   - What we know: `image` v0.25.9 uses `png` v0.18.1 transitively. Adding `png = "0.18"` as a direct dep should resolve to the same version.
   - What's unclear: Whether Cargo will deduplicate correctly if version constraints diverge in a future `image` update.
   - Recommendation: Pin to `png = "0.18"` and add a comment noting it must stay in sync with the `image` crate's transitive dependency. Verify with `cargo tree -d` after adding.

## Sources

### Primary (HIGH confidence)

- [image crate v0.25.9 docs: ImageDecoder trait](https://docs.rs/image/0.25.9/image/trait.ImageDecoder.html) -- confirmed exif_metadata(), icc_profile(), xmp_metadata(), iptc_metadata(), orientation() methods
- [image crate CHANGES.md](https://docs.rs/crate/image/latest/source/CHANGES.md) -- confirmed metadata methods added in v0.25.4, expanded through v0.25.9
- [image crate v0.25.9 docs: ColorType enum](https://docs.rs/image/0.25.9/image/enum.ColorType.html) -- confirmed variants and utility methods (bits_per_pixel, has_alpha, channel_count)
- [kamadak-exif v0.6.1 docs: Reader struct](https://docs.rs/kamadak-exif/0.6.1/exif/struct.Reader.html) -- confirmed read_raw() API for parsing pre-extracted EXIF bytes
- [kamadak-exif crates.io](https://crates.io/crates/kamadak-exif) -- version and license info
- [png crate text_metadata module](https://docs.rs/png/latest/png/text_metadata/index.html) -- confirmed TEXtChunk, ZTXtChunk, ITXtChunk structs and Info field access
- [serde-wasm-bindgen docs](https://docs.rs/serde-wasm-bindgen) -- confirmed to_value() pattern for struct serialization
- [wasm-bindgen guide: Arbitrary Data with Serde](https://rustwasm.github.io/docs/wasm-bindgen/reference/arbitrary-data-with-serde.html) -- confirmed serde_wasm_bindgen as recommended approach

### Secondary (MEDIUM confidence)

- [kamadak/exif-rs GitHub](https://github.com/kamadak/exif-rs) -- checked issues and activity; last active ~2024-2025. Accessed: 2026-03-19
- [CVE-2021-21235 details](https://cve.report/vendor/kamadak-exif_project) -- confirmed vulnerability patched in v0.5.3. Accessed: 2026-03-19
- [RUSTSEC-2021-0143](https://rustsec.org/advisories/RUSTSEC-2021-0143.html) -- confirmed advisory for kamadak-exif DoS with untrusted PNG data. Accessed: 2026-03-19
- [nom-exif crates.io](https://crates.io/crates/nom-exif) -- alternative EXIF crate evaluation. Accessed: 2026-03-19
- [rexif GitHub](https://github.com/kornelski/rexif) -- alternative evaluation; noted as "early stages". Accessed: 2026-03-19
- [tsify-next GitHub](https://github.com/AmbientRun/tsify-next) -- TS type generation option, not recommended for this project's existing pattern. Accessed: 2026-03-19

### Tertiary (LOW confidence)

- Performance estimates for kamadak-exif WASM are inferred from crate size and pure-Rust nature -- no published benchmarks found. Flag for validation.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- based on official docs for image v0.25.9 and kamadak-exif v0.6.1
- Architecture: HIGH -- follows existing project patterns (get_dimensions, convert_image)
- EXIF parsing: HIGH -- kamadak-exif API verified via docs.rs, CVE history checked
- PNG text chunks: HIGH -- png crate API verified via docs.rs, already transitive dep
- serde-wasm-bindgen patterns: HIGH -- project already uses this exact pattern
- Performance: LOW -- estimates only, no published benchmarks for WASM context
- Frontend patterns: MEDIUM -- HTML details/summary is standard, but component design is recommendation not verification

**Research date:** 2026-03-19
