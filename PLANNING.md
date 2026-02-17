# Rust + WebAssembly Image Converter — Project Plan

## Overview

A client-side web application that converts images between formats using Rust compiled to WebAssembly. All processing happens in the browser — no server-side computation required.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  Browser                                    │
│                                             │
│  ┌───────────────┐    ┌──────────────────┐  │
│  │  JS Frontend  │───▶│   Web Worker     │  │
│  │  (Vite + TS)  │◀───│                  │  │
│  │               │    │  ┌────────────┐  │  │
│  │  - File input │    │  │ Rust WASM  │  │  │
│  │  - Format     │    │  │ Module     │  │  │
│  │    selector   │    │  │            │  │  │
│  │  - Preview    │    │  │ image crate│  │  │
│  │  - Download   │    │  └────────────┘  │  │
│  └───────────────┘    └──────────────────┘  │
└─────────────────────────────────────────────┘
```

**Frontend**: TypeScript + Parcel (zero-config bundler with native WASM support)
**Backend (WASM)**: Rust `image` crate compiled via `wasm-pack`
**Threading**: Web Worker to keep UI responsive during conversion

### Why JS/TS frontend + Rust WASM library (not a full Rust frontend)?

- The UI is simple (file picker, format selector, preview, download button) — a full Rust frontend framework (Yew/Leptos) would be overkill.
- Faster iteration on UI/styling with standard web tools.
- Clean separation: Rust handles compute-intensive image processing, JS handles the DOM.

---

## Architectural Considerations

### Memory & File Size Limits

The processing pipeline has constraints at multiple layers. The tightest bottleneck is WASM's 4 GB linear memory (wasm32) combined with the memory multiplier from image decoding.

**Bottleneck chain (desktop):**

| Layer | Limit |
|-------|-------|
| File API / ArrayBuffer | ~2.15 GB (Chrome), ~8 GB (Firefox) |
| WASM linear memory (wasm32) | 4 GB hard ceiling |
| Browser tab/process | 8-16 GB |
| Worker transfer (transferable) | No limit (zero-copy, O(1)) |

**Mobile is much more constrained:**

| Layer | Limit |
|-------|-------|
| WASM reliable allocation | ~300 MB |
| iOS Jetsam process limit | ~300-450 MB total (kills process silently, not catchable) |

**Memory multiplier during conversion:**

```
Total memory ≈  compressed input    (~file size)
              + decoded RGBA pixels  (W × H × 4 bytes)
              + working buffer       (W × H × 4 bytes)
              + encoded output       (~output file size)
              + WASM overhead        (~20-50 MB)
```

Example: a 24 MP image (6000×4000) = 96 MB decoded RGBA → pipeline total ~230-320 MB.

**V1 limits (conservative, reliable cross-browser):**

- **Max file size: 200 MB**
- **Max decoded image: ~100 megapixels** (~400 MB RGBA)
- Pipeline total stays under ~1.6 GB, well within 4 GB WASM memory

The `image` crate can read dimensions from headers without full decoding, so we can validate both file size and pixel dimensions cheaply before attempting conversion.

**Failure modes:**

- Desktop: WASM `memory.grow()` returns `-1` or `ArrayBuffer` throws `RangeError` — both catchable.
- Mobile (iOS): Jetsam kills the process silently — not catchable. We must prevent this by enforcing limits upfront.

**Future expansion paths (post-V1):**

- Raise limit to 500 MB file size + ~375 MP dimension check
- Memory64 (wasm64): raises WASM ceiling to 16 GB, but 10-100% perf penalty and no Safari support yet
- Tiled/chunked processing: process image in strips without loading all pixels — removes the WASM memory bottleneck entirely
- Streaming file reads via `Blob.slice()` to bypass ArrayBuffer limits

### Performance

1. **Web Worker** — All WASM conversion runs off the main thread to keep UI responsive.
2. **Transferable objects** — Use `postMessage(result, [result.buffer])` to transfer (not copy) byte arrays between Worker and main thread. Transfer is O(1) regardless of size.
3. **Minimize JS↔WASM boundary crossings** — Pass entire image buffer in one call, return result in one call. No per-pixel callbacks.
4. **Binary size** — Only enable needed format features in the `image` crate. Expected WASM binary: ~1-3 MB after `wasm-opt -O3`.
5. **SIMD** — Optional future optimization. Compile with `-C target-feature=+simd128` for supported browsers.

### Architecture Scaling Notes

Areas that are fine for the MVP but would need refactoring as the app grows:

1. **Vanilla TS → lightweight framework** — Manual DOM state management works for the current simple UI (file picker, format selector, preview, download). If the app grows to include batch conversion, history, settings panels, or side-by-side comparison, consider migrating to a lightweight framework (Preact, Lit, or similar) to manage state and component lifecycle.

2. **Single Worker → Worker pool** — The current architecture processes one conversion at a time. Batch conversion would need either sequential processing in the single Worker (simple, slower) or a pool of Workers for parallel conversions (complex, faster). The current design doesn't prevent either approach.

3. **Estimated → real progress reporting** — The MVP uses a frontend-estimated progress bar (no Rust/Worker changes). For real progress, the Rust side would need to call back into JS mid-conversion via `wasm-bindgen` closures, with a structured Worker message protocol (`{ type: "progress", percent: 45 }`). The `image` crate's `load_from_memory` and `write_to` don't expose progress callbacks natively, so this would require custom decoder/encoder wrappers — significant effort for marginal UX gain over the estimated approach.

4. **No cancellation** — Once a conversion starts, it runs to completion. Cancellation options: `Worker.terminate()` (heavy — destroys and recreates the Worker and WASM module) or cooperative cancellation in Rust via a shared flag (complex, requires `SharedArrayBuffer` + Atomics and COOP/COEP headers). Not needed for V1 but relevant for large images or batch processing.

---

## Supported Image Formats

### Tier 1 — Launch formats (reliable in WASM)

| Format | Decode | Encode | Notes |
|--------|--------|--------|-------|
| PNG    | Yes    | Yes    | Pure Rust. Reliable. |
| JPEG   | Yes    | Yes    | Pure Rust. Reliable. |
| WebP   | Yes    | No     | Pure Rust decoder. Encoder is lossless-only — skipped as output format for V1. |
| GIF    | Yes    | Yes    | Pure Rust. Supports animation. |
| BMP    | Yes    | Yes    | Built-in, simple format. |

### Tier 2 — Add later

| Format | Decode | Encode | Notes |
|--------|--------|--------|-------|
| TIFF   | Yes    | Yes    | Pure Rust. |
| ICO    | Yes    | Yes    | Built-in. |
| TGA    | Yes    | Yes    | Built-in. |
| QOI    | Yes    | Yes    | Fast lossless format. |
| SVG    | Yes*   | No     | Requires `resvg` to rasterize, then encode to target. |

### Not recommended for WASM

| Format | Why |
|--------|-----|
| AVIF   | Encoding via `ravif` is extremely slow in WASM. Decoder (`dav1d`) requires C deps. Revisit when pure-Rust tooling matures. |

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Image processing | `image` crate v0.25+ | De facto Rust standard, pure-Rust codecs, WASM-compatible |
| Rust→WASM glue | `wasm-bindgen` | JS↔Rust type marshalling |
| WASM build tool | `wasm-pack` | Builds Rust to WASM, generates npm-compatible package |
| WASM optimizer | `wasm-opt` (Binaryen) | 20-30% smaller/faster binaries |
| Frontend bundler | Parcel | Zero-config, native WASM support, no plugins needed |
| Frontend language | TypeScript | Type safety for the JS layer |
| UI framework | Vanilla TS (no framework) | App is simple enough; avoids unnecessary dependencies |
| Styling | Tailwind CSS v4 | Utility-first, build-time processing via PostCSS, zero runtime overhead |
| Integration testing | Playwright | Headless browser tests for Worker↔WASM pipeline |
| Analytics | PostHog (JS SDK) | Event tracking, usage insights, deployed product analytics |

---

## Project Structure

```
rust-image-converter/
├── Cargo.toml                      # Workspace root
├── crates/
│   └── image-converter/            # Rust WASM library
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs              # #[wasm_bindgen] exports
│           ├── convert.rs          # Core conversion logic
│           └── formats.rs          # Format detection & mapping
├── web/                            # Frontend
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── .postcssrc                  # Tailwind PostCSS config
│   └── src/
│       ├── main.ts                 # Entry point
│       ├── worker.ts               # Web Worker for WASM calls
│       ├── ui.ts                   # DOM manipulation / UI logic
│       └── styles.css
├── PLANNING.md                     # This file
└── .gitignore
```

---

## Rust WASM API Design

The WASM module exposes a minimal API:

```rust
use wasm_bindgen::prelude::*;

/// Convert an image from one format to another.
/// `input` — raw bytes of the source image.
/// `target_format` — e.g. "png", "jpeg", "gif", "bmp".
/// Returns the converted image as raw bytes.
#[wasm_bindgen]
pub fn convert_image(input: &[u8], target_format: &str) -> Result<Vec<u8>, JsError> {
    // ...
}

/// Detect the format of an image from its bytes.
/// Returns a string like "png", "jpeg", etc.
#[wasm_bindgen]
pub fn detect_format(input: &[u8]) -> Result<String, JsError> {
    // ...
}

/// Get image dimensions without fully decoding.
#[wasm_bindgen]
pub fn get_dimensions(input: &[u8]) -> Result<JsValue, JsError> {
    // Returns { width: u32, height: u32 }
}
```

---

## Frontend Data Flow

1. User drops/selects an image file via `<input type="file">` or drag-and-drop.
2. JS validates file size (reject if > 200 MB).
3. JS reads the file as `ArrayBuffer` → `Uint8Array`.
4. JS posts the bytes to a **Web Worker**.
5. Worker calls `get_dimensions()` — rejects if > 100 megapixels.
6. Worker calls `convert_image()` with the target format.
7. **Meanwhile on the main thread**: estimated progress bar starts animating (see below).
8. Worker posts the result bytes back (using transferable objects, zero-copy).
9. Progress bar snaps to 100%.
10. JS creates a `Blob` → `URL.createObjectURL()` for preview and download.

### Estimated Progress Bar

Frontend-only — no Rust or Worker changes required.

**Estimation model** (calibrated from benchmark data):

```
estimated_ms = base_ms[format_pair] + (megapixels * ms_per_mp[format_pair])
```

Format-pair rates (initial estimates, refined from real benchmark data):

| Conversion | base_ms | ms_per_mp |
|------------|---------|-----------|
| JPEG → PNG | 20 | 40 |
| PNG → JPEG | 20 | 25 |
| WebP → PNG | 20 | 35 |
| BMP → JPEG | 20 | 25 |
| *fallback* | 30 | 50 |

**Behaviour:**

- On conversion start: calculate `estimated_ms`, begin CSS transition on progress bar width from 0% → 90% over `estimated_ms * 0.9`.
- The bar never reaches 100% on its own — it eases into ~90% and holds.
- On Worker response (success or error): immediately transition to 100%, then show result.
- If the Worker responds before the bar reaches 90%: snap to 100% (feels fast).
- If the Worker takes longer: the bar sits near 90% until the real result arrives (the "90% stall" — a well-known pattern users accept intuitively).

**Implementation**: ~30-40 lines of TS + a CSS transition. No complex state management needed.

---

## Key Rust/WASM Configuration

### Cargo.toml for the WASM crate

```toml
[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"
image = { version = "0.25", default-features = false, features = [
    "png", "jpeg", "gif", "webp", "bmp"
] }

[profile.release]
opt-level = "s"       # Optimize for size
lto = true            # Link-time optimization
strip = true          # Strip debug info
```

**Critical**: `default-features = false` on the `image` crate — the defaults enable `rayon` (multithreading) which breaks single-threaded WASM.

---

## Build & Dev Commands

```bash
# One-time setup
rustup target add wasm32-unknown-unknown
cargo install wasm-pack

# Build WASM (from project root)
wasm-pack build crates/image-converter --target web --release

# Frontend dev (from web/ directory)
cd web && npm install && npx parcel src/index.html

# Production build
wasm-pack build crates/image-converter --target web --release
cd web && npx parcel build src/index.html
```

---

## Testing Strategy

### Unit Tests (Rust)

Run with `cargo test` (native) and `wasm-pack test --headless --chrome` (WASM).

#### Format Conversion Matrix

Test every supported input→output combination:

| Input↓ / Output→ | PNG | JPEG | GIF | BMP |
|-------------------|-----|------|-----|-----|
| PNG               | -   | T    | T   | T   |
| JPEG              | T   | -    | T   | T   |
| WebP              | T   | T    | T   | T   |
| GIF               | T   | T    | -   | T   |
| BMP               | T   | T    | T   | -   |

Each cell (T) is a test that verifies:
- Output bytes are valid (can be decoded back)
- Output format matches the requested format
- Image dimensions are preserved

#### Image Size Variants

Test each conversion path against multiple image sizes:

| Category | Dimensions | Pixel Count | Expected RGBA Size | Purpose |
|----------|-----------|-------------|-------------------|---------|
| Tiny | 1x1 | 1 | 4 B | Edge case — minimum valid image |
| Small | 100x100 | 10 K | 40 KB | Fast test baseline |
| Medium | 1920x1080 | ~2 MP | ~8 MB | Typical photo |
| Large | 4000x3000 | 12 MP | ~48 MB | High-res camera photo |
| Wide | 10000x100 | 1 MP | ~4 MB | Unusual aspect ratio |
| Tall | 100x10000 | 1 MP | ~4 MB | Unusual aspect ratio |
| Square max | 10000x10000 | 100 MP | ~400 MB | At the dimension limit |

Note: The "Square max" test should only run in CI or with a `#[ignore]` attribute due to memory requirements.

#### Format Detection

- Detect PNG, JPEG, WebP, GIF, BMP from valid file bytes
- Return appropriate error for unrecognized/corrupted bytes
- Detect format correctly even if file extension would be misleading (we work with bytes, not filenames)

#### Dimension Reading

- Correct dimensions for each supported format
- Correct dimensions for unusual aspect ratios
- Error on corrupted/truncated headers

#### Error Cases

| Test | Input | Expected |
|------|-------|----------|
| Empty input | `&[]` | Error: meaningful message |
| Truncated file | First 100 bytes of a valid PNG | Error: decode failure |
| Random bytes | Random `&[u8; 1024]` | Error: unrecognized format |
| Unsupported output format | Valid PNG, target = `"avif"` | Error: unsupported format |
| Invalid format string | Valid PNG, target = `"notaformat"` | Error: unsupported format |

#### Performance Timing (Rust)

Every conversion test records and reports elapsed time. Use `std::time::Instant` in native tests and `web_sys::window().performance().now()` in WASM tests.

Each test logs a structured line:

```
[PERF] PNG → JPEG | 1920x1080 | input: 2.4 MB | output: 0.8 MB | decode: 45 ms | encode: 32 ms | total: 77 ms
```

**Timing breakdown per conversion:**

| Metric | What it measures |
|--------|-----------------|
| `decode` | Time to decode input bytes into raw pixels |
| `encode` | Time to encode raw pixels into target format |
| `total` | Full `convert_image()` call (decode + encode + overhead) |

**Benchmark matrix** — Run the full format conversion matrix against each image size variant and record all timings. This produces a performance profile like:

| Size | PNG→JPEG | JPEG→PNG | WebP→PNG | BMP→JPEG | ... |
|------|----------|----------|----------|----------|-----|
| 100x100 | 2 ms | 3 ms | 4 ms | 1 ms | |
| 1920x1080 | 77 ms | 120 ms | 95 ms | 65 ms | |
| 4000x3000 | 310 ms | 480 ms | 390 ms | 270 ms | |

**Implementation approach:**
- Wrap each conversion in timing calls and print results to stdout
- Run benchmarks separately from correctness tests via a `#[cfg(feature = "bench")]` feature flag or a dedicated `benches/` directory using `criterion` (for native) to get statistically stable measurements
- For WASM benchmarks, use `wasm-pack test` with `performance.now()` — these won't be as stable as `criterion` but give a realistic browser-context measurement

#### Pixel Fidelity

- PNG→PNG round-trip: pixel-perfect (lossless→lossless)
- BMP→PNG round-trip: pixel-perfect
- JPEG→PNG: dimensions preserved (lossy source, so no pixel-perfect check)
- Verify alpha channel is preserved where both formats support it (PNG→PNG, PNG→GIF)

### Integration Tests (Frontend ↔ WASM Worker)

Run with a headless browser test runner (Playwright).

These tests verify the full pipeline: file input → Worker → WASM → Worker → main thread → output.

#### Worker Lifecycle

| Test | What it verifies |
|------|-----------------|
| WASM initializes in Worker | Worker can load and init the WASM module without errors |
| Worker responds to conversion message | Post a valid image buffer, receive converted bytes back |
| Worker returns errors correctly | Post invalid bytes, receive a structured error message (not a silent failure or crash) |
| Multiple sequential conversions | Convert 3 images in sequence — no memory leaks or stale state |
| Worker handles large transfers | Send and receive a ~50 MB buffer via transferable objects without timeout |

#### End-to-End Conversion

| Test | Steps | Assertion |
|------|-------|-----------|
| File select → convert → download | Programmatically set file input, click convert, verify download blob | Blob is valid, correct MIME type, non-zero size |
| Format auto-detection | Load a JPEG, verify the UI displays "JPEG" as source format | Detected format string matches |
| Before/after metadata | Convert a known image, verify dimensions and file sizes display | Correct numbers rendered in DOM |
| Error display | Load a corrupted file, trigger convert | User-friendly error shown in UI, no console errors |

#### Validation Guards

| Test | Steps | Assertion |
|------|-------|-----------|
| File size limit | Attempt to load a >200 MB file | Rejected before reaching Worker, error shown in UI |
| Dimension limit | Load a valid image that exceeds 100 MP | Rejected after dimension check, error shown in UI |

#### Performance Timing (Integration)

Measure the full pipeline time from the frontend's perspective using `performance.now()`:

| Metric | What it measures |
|--------|-----------------|
| `worker_init` | Time for Worker to load and initialize WASM module |
| `transfer_to_worker` | Time to post image bytes to Worker |
| `conversion` | Time the Worker spends on the WASM `convert_image()` call |
| `transfer_from_worker` | Time to receive result bytes back on main thread |
| `total_pipeline` | End-to-end from "user clicks convert" to "output blob ready" |

Each integration conversion test logs:

```
[PERF E2E] PNG → JPEG | 1920x1080 | worker_init: 120 ms | transfer_in: 1 ms | conversion: 77 ms | transfer_out: 0 ms | total: 198 ms
```

This reveals where time is actually spent — if `worker_init` dominates, we may want to pre-initialize the Worker on page load rather than on first conversion.

#### Memory & Performance

| Test | What it verifies |
|------|-----------------|
| No main thread blocking | Start a conversion, verify UI remains responsive (e.g., a CSS animation doesn't freeze) |
| Blob URL cleanup | After download, verify `URL.revokeObjectURL()` was called (no memory leak) |

### Test Infrastructure

```
rust-image-converter/
├── crates/
│   └── image-converter/
│       ├── src/
│       └── tests/
│           ├── fixtures/           # Small test images (one per format)
│           │   ├── test.png
│           │   ├── test.jpg
│           │   ├── test.webp
│           │   ├── test.gif
│           │   └── test.bmp
│           ├── convert_test.rs     # Format conversion matrix tests
│           ├── detect_test.rs      # Format detection tests
│           └── dimensions_test.rs  # Dimension reading tests
│       └── benches/
│           └── conversion_bench.rs # Criterion benchmarks (native)
├── web/
│   └── tests/
│       ├── integration/
│       │   ├── worker.spec.ts      # Worker lifecycle tests
│       │   ├── conversion.spec.ts  # End-to-end conversion tests
│       │   └── validation.spec.ts  # Validation guard tests
│       └── fixtures/               # Test images for frontend tests
```

### Test Fixtures

Generate test images programmatically where possible (using the `image` crate in a build script or test helper) rather than checking in large binary files. Only check in a minimal set of real-world format samples for format detection tests.

### Running Tests

```bash
# Rust unit tests (native)
cargo test --manifest-path crates/image-converter/Cargo.toml

# Rust WASM tests (headless browser)
wasm-pack test --headless --chrome crates/image-converter

# Rust benchmarks (native, via criterion)
cargo bench --manifest-path crates/image-converter/Cargo.toml

# Frontend integration tests (includes pipeline timing)
cd web && npx playwright test
```

---

## Analytics (PostHog)

Initialize the PostHog JS SDK on page load. All events are fired from the frontend (main thread), never from the Worker.

**Privacy**: No image data, filenames, or file contents are ever sent to PostHog. Only metadata (format, size, dimensions, timings).

### Events

#### `app_loaded`

Fired once on page load after WASM Worker is initialized.

| Property | Type | Example |
|----------|------|---------|
| `wasm_init_ms` | number | `120` |
| `browser` | string | Auto-captured by PostHog |
| `device_type` | string | Auto-captured by PostHog |

#### `image_selected`

Fired when the user selects or drops a file.

| Property | Type | Example |
|----------|------|---------|
| `source_format` | string | `"jpeg"` |
| `file_size_bytes` | number | `4200000` |
| `width` | number | `4000` |
| `height` | number | `3000` |
| `megapixels` | number | `12.0` |
| `input_method` | string | `"drag_drop"` or `"file_picker"` |

#### `conversion_started`

Fired when the user clicks Convert.

| Property | Type | Example |
|----------|------|---------|
| `source_format` | string | `"jpeg"` |
| `target_format` | string | `"png"` |
| `file_size_bytes` | number | `4200000` |
| `megapixels` | number | `12.0` |

#### `conversion_completed`

Fired when the Worker returns a successful result.

| Property | Type | Example |
|----------|------|---------|
| `source_format` | string | `"jpeg"` |
| `target_format` | string | `"png"` |
| `input_size_bytes` | number | `4200000` |
| `output_size_bytes` | number | `15800000` |
| `size_change_pct` | number | `276.2` |
| `width` | number | `4000` |
| `height` | number | `3000` |
| `megapixels` | number | `12.0` |
| `conversion_ms` | number | `310` |
| `pipeline_total_ms` | number | `315` |

#### `conversion_failed`

Fired when the Worker returns an error.

| Property | Type | Example |
|----------|------|---------|
| `source_format` | string \| null | `"jpeg"` or `null` if detection failed |
| `target_format` | string | `"png"` |
| `file_size_bytes` | number | `4200000` |
| `error_type` | string | `"decode_error"`, `"encode_error"`, `"unsupported_format"` |
| `error_message` | string | `"Failed to decode image"` |

#### `validation_rejected`

Fired when a file is rejected before conversion.

| Property | Type | Example |
|----------|------|---------|
| `reason` | string | `"file_too_large"` or `"dimensions_too_large"` |
| `file_size_bytes` | number | `250000000` |
| `megapixels` | number \| null | `120.0` or `null` if rejected before dimension check |

#### `download_clicked`

Fired when the user clicks the download button.

| Property | Type | Example |
|----------|------|---------|
| `source_format` | string | `"jpeg"` |
| `target_format` | string | `"png"` |
| `output_size_bytes` | number | `15800000` |

### Event Flow

```
User lands on page
  → app_loaded

User selects/drops a file
  → image_selected
  → (if rejected) validation_rejected  [end]

User clicks Convert
  → conversion_started
  → conversion_completed  OR  conversion_failed

User clicks Download
  → download_clicked
```

### Implementation Notes

- Use `posthog-js` SDK, initialized in `main.ts` with the project API key
- Store the PostHog API key in an environment variable (not hardcoded)
- Disable PostHog in development (`posthog.opt_out_capturing()`) or use a separate dev project key
- PostHog auto-captures pageviews, sessions, and device info — no need to track those manually

---

## SEO Strategy

### Key Advantage

Since the frontend is vanilla TS (not a JS framework that renders everything client-side), all static content lives directly in `index.html` — fully crawlable by search engines without needing SSR or prerendering. The WASM/JS enhances the page with functionality, but the content is already in the HTML.

### Target Keywords

**Primary (high volume, competitive):**
- "image converter online"
- "convert image format online"
- "free image converter"

**Long-tail (lower volume, higher intent, easier to rank):**
- "convert png to jpeg online free"
- "webp to png converter"
- "convert bmp to png online"
- "jpeg to gif converter"
- "[format] to [format] converter" (every supported pair)

**Long-tail format pairs to target** (12 combinations from our supported formats):

| → | PNG | JPEG | GIF | BMP |
|---|-----|------|-----|-----|
| **PNG** | - | png to jpeg | png to gif | png to bmp |
| **JPEG** | jpeg to png | - | jpeg to gif | jpeg to bmp |
| **WebP** | webp to png | webp to jpeg | webp to gif | webp to bmp |
| **GIF** | gif to png | gif to jpeg | - | gif to bmp |
| **BMP** | bmp to png | bmp to jpeg | bmp to gif | - |

### Technical SEO (in `index.html`)

#### Meta Tags

```html
<title>Free Image Converter — PNG, JPEG, WebP, GIF, BMP | Online & Private</title>
<meta name="description" content="Convert images between PNG, JPEG, WebP, GIF, and BMP instantly in your browser. No upload to any server — 100% private, free, and fast.">
<meta name="keywords" content="image converter, png to jpeg, webp to png, convert image online, free image converter">
<link rel="canonical" href="https://[domain]/">
<meta name="robots" content="index, follow">
```

#### Open Graph / Social Sharing

```html
<meta property="og:title" content="Free Image Converter — PNG, JPEG, WebP, GIF, BMP">
<meta property="og:description" content="Convert images instantly in your browser. No uploads, 100% private.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://[domain]/">
<meta property="og:image" content="https://[domain]/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Free Image Converter — PNG, JPEG, WebP, GIF, BMP">
<meta name="twitter:description" content="Convert images instantly in your browser. No uploads, 100% private.">
```

#### Structured Data (JSON-LD)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Image Converter",
  "description": "Convert images between PNG, JPEG, WebP, GIF, and BMP formats. Runs entirely in your browser — no server uploads.",
  "url": "https://[domain]/",
  "applicationCategory": "UtilitiesApplication",
  "operatingSystem": "Any (browser-based)",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "browserRequirements": "Requires WebAssembly support"
}
</script>
```

#### FAQ Schema (targets featured snippets)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I convert a PNG to JPEG?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Drop your PNG file onto the converter, select JPEG as the output format, and click Convert. Your converted file downloads instantly — no server upload required."
      }
    },
    {
      "@type": "Question",
      "name": "Is this image converter safe to use?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. All conversion happens locally in your browser using WebAssembly. Your images are never uploaded to any server."
      }
    },
    {
      "@type": "Question",
      "name": "What image formats are supported?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "You can convert between PNG, JPEG, GIF, and BMP. WebP files can be converted to any of these formats."
      }
    },
    {
      "@type": "Question",
      "name": "What is the maximum file size?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Files up to 200 MB are supported. Images can be up to 100 megapixels."
      }
    }
  ]
}
</script>
```

### On-Page Content

The `index.html` should include visible, crawlable text (not injected by JS):

1. **H1**: "Free Image Converter — Convert PNG, JPEG, WebP, GIF, BMP Online"
2. **Subheading**: "100% private — your images never leave your browser"
3. **How It Works** section (3 steps: drop file, pick format, download)
4. **Supported Formats** section with brief descriptions of each format
5. **FAQ section** (matches the FAQ schema above, rendered as visible `<details>/<summary>` or similar)
6. **Privacy note**: Emphasise that processing is local — this is a genuine differentiator from competitors like CloudConvert/Convertio that upload to servers

### Privacy as a Differentiator

Most competing image converters upload files to a server. Our client-side WASM approach is a genuine selling point for SEO copy:
- "No upload required" / "100% private"
- "Works offline" (if PWA is added later)
- "Your images never leave your device"

This messaging should be prominent in the title, meta description, H1, and page content. It's both a trust signal for users and a differentiator that search engines can surface in snippets.

### Core Web Vitals

Google uses Core Web Vitals as a ranking signal. Key targets:

| Metric | Target | How we achieve it |
|--------|--------|-------------------|
| **LCP** (Largest Contentful Paint) | < 2.5s | Static HTML content, small CSS, defer WASM loading |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Fixed-size layout for tool area, no late-loading ads or banners |
| **INP** (Interaction to Next Paint) | < 200ms | All conversion in Web Worker, main thread stays free |

**WASM load strategy**: Load the WASM module lazily — don't block page render. Initialize the Worker in the background after the page is interactive. The tool UI is visible and the static content is readable immediately.

### Additional Files

| File | Purpose |
|------|---------|
| `robots.txt` | Allow all crawlers |
| `sitemap.xml` | Single-page for now, but needed for search console submission |
| `og-image.png` | Social sharing preview image (1200x630) |
| `favicon.ico` + `apple-touch-icon.png` | Branding in search results and bookmarks |

### Stretch: Format-Specific Landing Pages

Post-MVP, create lightweight pages for high-value keyword pairs:
- `/png-to-jpeg` — "Convert PNG to JPEG Online Free"
- `/webp-to-png` — "Convert WebP to PNG Online Free"
- etc.

Each page is the same tool but with format-specific H1, meta tags, and pre-selected source/target formats via URL parameters. This is how competitors like CloudConvert rank for hundreds of long-tail keywords. Could be implemented as a single `index.html` that reads the URL path and adjusts the visible text + pre-selects the format dropdowns.

---

## MVP Feature Scope

- [x] File input (click to browse + drag-and-drop)
- [x] Auto-detect source format and display it
- [x] Target format selector (PNG, JPEG, GIF, BMP)
- [x] Convert button
- [x] Preview of converted image
- [x] Download converted image
- [x] Display image dimensions and file size (before/after)
- [x] Estimated progress bar during conversion (see below)
- [x] Error handling with user-friendly messages
- [x] File size validation (200 MB limit)
- [x] Pixel dimension validation (100 MP limit)
- [ ] Rust unit tests (conversion matrix, format detection, error cases)
- [ ] Integration tests (Worker lifecycle, end-to-end conversion, validation guards)
- [x] PostHog analytics (7 events, env-based API key, disabled in dev)
- [x] SEO: meta tags, Open Graph, JSON-LD (WebApplication + FAQ schemas)
- [x] SEO: on-page content (H1, how it works, supported formats, FAQ, privacy note)
- [x] SEO: robots.txt, sitemap.xml, favicon, og-image
- [x] SEO: Core Web Vitals optimization (lazy WASM load, fixed layout, Worker offload)

## Stretch Goals (post-MVP)

- [ ] Batch conversion (multiple files)
- [ ] JPEG quality slider
- [ ] Image resize options
- [ ] Tier 2 format support (TIFF, ICO, TGA, QOI, SVG→raster)
- [ ] Side-by-side before/after comparison
- [ ] Paste from clipboard
- [ ] PWA support (offline usage)
- [ ] Dark mode
- [ ] Raise file size limit to 500 MB (with dimension guard)
- [ ] Real progress reporting from Rust (replace estimated bar with actual decode/encode progress)
- [ ] Format-specific landing pages (`/png-to-jpeg`, `/webp-to-png`, etc.) for long-tail SEO

---

## Open Questions

1. **Mobile-specific limits** — Should we detect mobile and enforce a lower limit (~20 MB / ~15 MP), or let it fail gracefully?
2. **WebP lossy output** — Revisit when a pure-Rust lossy WebP encoder becomes available, or investigate compiling `libwebp` to WASM separately.
