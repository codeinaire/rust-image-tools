# Comprehensive Codebase Overview

A complete reference for the rust-image-tools project — a client-side web application for image format conversion using Rust compiled to WebAssembly. All conversion happens in the browser; no server uploads, 100% private.

## What It Is

A browser-based image converter where:
- The UI is written in TypeScript (Parcel bundler, Tailwind CSS v4)
- Image processing is handled by Rust compiled to WASM via `wasm-pack`
- All WASM work runs in a Web Worker to keep the UI responsive
- No backend — everything runs client-side

## Why It Matters for This Project

Understanding the full codebase is essential for:
- Adding new features without breaking existing architecture
- Knowing which layer (Rust vs. Worker vs. UI) owns each responsibility
- Avoiding regressions in the Worker message protocol or WASM API

---

## Architecture Diagram

```
Browser / Main Thread
  main.ts (ImageConverter class) — manages WASM & Worker, request/response routing
  ui.ts (User Interface) — file upload, validation, format selection, analytics
           ↕ postMessage
Web Worker Thread
  worker.ts — WASM module init, handles all operations, WebP canvas fallback
           ↕ WASM boundary
  image_converter.wasm (Rust)
    detect_format() | convert_image() | get_dimensions() | decode_to_rgba()
    (Powered by `image` crate)
```

---

## Frontend Structure (`web/src/`)

### `main.ts`

**ImageConverter class** — central coordinator between the UI and the Web Worker.

- Exposes a single instance via `window.__converter` for integration tests
- Core methods:
  - `ensureReady()` — waits for WASM module to finish loading
  - `detectFormat(data: Uint8Array)` — identifies image format from raw bytes
  - `convertImage(data, targetFormat)` — main conversion API
  - `convertImageTimed(data, targetFormat)` — returns conversion timing metadata
  - `getDimensions(data)` — reads image dimensions without full decoding
- Uses a request ID queue to match Worker responses to pending Promises

### `worker.ts`

Runs in an isolated Web Worker thread. Owns the WASM module instance.

- Imported WASM exports: `init()`, `convert_image()`, `detect_format()`, `get_dimensions()`, `decode_to_rgba()`
- Handlers: `handleDetectFormat()`, `handleConvertImage()`, `handleGetDimensions()`, `handleError()`
- **WebP output special case**: The `image` crate's WebP encoder is lossless-only and disabled. Instead:
  1. Call `decode_to_rgba()` in Rust to get raw RGBA pixels
  2. Draw pixels onto an `OffscreenCanvas` via Canvas 2D context
  3. Convert canvas to a WebP `Blob` at quality 0.85
  4. Read blob back as `ArrayBuffer` and return to main thread

### `worker-types.ts`

TypeScript message protocol between main thread and Worker (discriminated unions).

- Request types: `Init`, `DetectFormat`, `ConvertImage`, `GetDimensions`
- Response types: success variants and `Error`
- `ImageDimensions` interface: `{ width: number, height: number }`

### `ui.ts`

All DOM manipulation and user interaction logic.

- **Validation limits**: Max file size 200 MB, max dimensions 100 megapixels
- **State managed**: `currentFile`, `currentBytes`, `currentSourceFormat`, image dimensions, blob URL lifecycle
- **Features**:
  - Drag-and-drop + click-to-browse file input
  - Auto format detection on file load
  - Parallel dimension reading (`Promise.all` with format detection)
  - GIF performance warning for images ≥2 MP
  - Estimated progress bar (format-pair timing rates → animate to 90%, snap to 100% on completion)
  - Preview image display via Blob URL
  - Download link generation with correct MIME types and file extensions
  - File size & conversion time reporting
- **Analytics**: delegates to `analytics.ts` for all tracked events

### `analytics.ts`

PostHog analytics — conditional on production environment + `POSTHOG_KEY` env var.

| Event | When fired |
|-------|-----------|
| `app_loaded` | Page load, after WASM Worker initializes |
| `image_selected` | User drops/selects a file |
| `conversion_started` | User clicks Convert |
| `conversion_completed` | Worker returns success result |
| `conversion_failed` | Worker returns error |
| `validation_rejected` | File rejected before conversion |
| `download_clicked` | User clicks Download |

No image data, filenames, or file contents are ever sent — only metadata (format, size, dimensions, timings).

### `index.html`

- Semantic HTML5, Tailwind CSS v4, mobile-first responsive layout
- UI elements: drop zone, format selector dropdown (PNG, JPEG, WebP, GIF, BMP), progress bar, preview, download button
- Static SEO content (fully crawlable, not JS-rendered): H1, FAQ, "How It Works", "Supported Formats", privacy note
- JSON-LD structured data: `WebApplication` + `FAQPage` schemas
- Open Graph and Twitter Card meta tags

---

## Rust WASM Library (`crates/image-converter/src/`)

### `lib.rs` — WASM API surface

All `#[wasm_bindgen]` exports. All return `Result<T, JsError>` for JS error propagation.

```rust
// Identify image format from raw bytes
pub fn detect_format(input: &[u8]) -> Result<String, JsError>

// Convert image to target format
pub fn convert_image(input: &[u8], target_format: &str) -> Result<Vec<u8>, JsError>

// Decode image to raw RGBA8 pixels (used by WebP canvas encoding)
pub fn decode_to_rgba(input: &[u8]) -> Result<Vec<u8>, JsError>

// Read width/height without full pixel decode — returns { width, height }
pub fn get_dimensions(input: &[u8]) -> Result<JsValue, JsError>
```

### `formats.rs` — Format detection and mapping

```rust
pub enum ImageFormat { Png, Jpeg, WebP, Gif, Bmp }
pub enum FormatError { EmptyInput, Unrecognized, Unsupported, UnknownName, EncodeUnsupported }
```

- `detect_from_bytes()` — uses `image::guess_format()` + header inspection
- `from_name()` — parses strings, handles `"jpeg"`/`"jpg"` aliases
- `to_image_format()` — converts to `image` crate's format enum; returns `EncodeUnsupported` for WebP

### `convert.rs` — Core conversion pipeline

```rust
pub fn convert(input: Vec<u8>, target: ImageFormat) -> Result<Vec<u8>, ConvertError>
pub fn dimensions(input: &[u8]) -> Result<Dimensions, ConvertError>
pub fn decode_rgba(input: &[u8]) -> Result<Vec<u8>, ConvertError>

pub enum ConvertError { Decode(String), Encode(String), UnsupportedTarget(String) }
```

Key detail: **`input` is explicitly dropped after decoding** to free WASM linear memory before the encode step begins. This is critical for large images to avoid OOM.

```rust
let img = image::load_from_memory(&input)?;
drop(input); // free compressed bytes before allocating encoded output
```

### `Cargo.toml` — Key configuration

```toml
[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde-wasm-bindgen = "0.6"
image = { version = "0.25", default-features = false, features = [
    "png", "jpeg", "gif", "webp", "bmp"
] }

[package.metadata.wasm-pack.profile.release]
wasm-opt = false  # bundled wasm-opt doesn't support bulk memory ops
```

**Critical**: `default-features = false` on `image` disables `rayon` (multithreading), which breaks single-threaded WASM.

---

## Supported Formats

| Format | Decode | Encode | Notes |
|--------|--------|--------|-------|
| PNG | ✓ | ✓ | Lossless + transparency |
| JPEG | ✓ | ✓ | Lossy, optimized for photos |
| WebP | ✓ | ✗ Rust | Canvas-based encoding in JS (OffscreenCanvas) |
| GIF | ✓ | ✓ | 256-color palette; slow for large images |
| BMP | ✓ | ✓ | Uncompressed |

**Tier 2 (not yet implemented):** TIFF, ICO, TGA, QOI — all pure-Rust in `image` crate, planned for future.

---

## Key Features Implemented

1. Format detection via magic byte inspection
2. Image conversion: full decode→encode pipeline with explicit memory management
3. Dimension reading: fast header-only read without pixel decode
4. RGBA decoding: pixel data export for WebP canvas encoding
5. Web Worker isolation: WASM runs off main thread, non-blocking UI
6. File upload: drag-and-drop + click-to-browse
7. Validation: file size (≤200 MB) and dimensions (≤100 MP) limits
8. Progress tracking: estimated progress bar with format-pair timing rates
9. Preview display: Blob URL-based image preview
10. Download management: proper MIME types and filename extensions
11. Error handling: user-friendly error messages with error type classification
12. Analytics: PostHog integration (production-only)
13. GIF warning: performance notice for large images
14. WebP support: Canvas fallback for WebP output (OffscreenCanvas required)
15. SEO: complete structured data, Open Graph, meta tags
16. Responsive design: mobile-first Tailwind CSS layout

---

## Build Process

```bash
# Build WASM (from project root)
wasm-pack build crates/image-converter --target web --release

# Frontend dev server
cd web && npx parcel src/index.html

# Production build (builds WASM + frontend)
cd web && npm run build

# Rust unit tests
cargo test --manifest-path crates/image-converter/Cargo.toml

# WASM tests (headless browser)
wasm-pack test --headless --chrome crates/image-converter

# E2E tests (Playwright)
cd web && npx playwright test
```

---

## Testing Coverage

- **Rust unit tests**: 70+ tests covering all format conversion pairs, error paths, pixel fidelity, alpha channel preservation, and dimension reading
- **Criterion benchmarks**: Native performance benchmarks with HTML reports (`cargo bench`)
- **WASM tests**: `wasm-pack test --headless --chrome` for browser-context tests
- **E2E tests**: Playwright integration tests for Worker lifecycle, conversion pipeline, and validation guards

Test fixtures are generated programmatically where possible (using the `image` crate in test helpers) rather than checking in large binary files.

---

## Gotchas and Important Details

- **`wasm-opt = false`**: The bundled `wasm-opt` in `wasm-pack` doesn't support bulk memory operations. If `wasm-opt` is enabled, WASM will fail to load in the browser.
- **WebP encode path**: WebP encoding goes through `OffscreenCanvas`, not Rust. This means WebP output quality is controlled by the browser, not the `image` crate. `OffscreenCanvas` requires a secure context (HTTPS or localhost).
- **Memory management**: Explicitly `drop(input)` after decoding in Rust is critical. WASM linear memory is not garbage collected — holding the compressed input while allocating decoded pixels + encoded output can OOM on mobile.
- **iOS memory limits**: iOS Jetsam kills processes silently at ~300–450 MB total. The 200 MB file size + 100 MP pixel limits are conservative to stay well under this threshold. Errors from Jetsam are not catchable.
- **Worker message protocol**: All Worker messages use request IDs for matching responses to Promises. Adding new message types requires updating `worker-types.ts`, `worker.ts`, and the corresponding `main.ts` method.

---

## Recent Git History

- Plan 13: WebP canvas encoding implementation
- Plan 12: PostHog analytics integration
- Plan 11: Rust performance benchmarks
- Plan 10: Playwright E2E testing
- Plan 9: Analytics events
- Plan 8: SEO optimization
- Plan 7: Validation & error handling
- Plan 6: UI implementation
- Plan 5: Web Worker integration
- Plans 1–4: Initial scaffolding, format detection, testing, frontend setup

## References

- [PLANNING.md](../PLANNING.md) — Full architecture documentation, memory limits, testing strategy, SEO plan
- [ROADMAP.md](../ROADMAP.md) — Feature roadmap with difficulty ratings and implementation plans
- [`image` crate docs](https://docs.rs/image/0.25.9/image/) — Rust image processing library
- [`wasm-bindgen` guide](https://rustwasm.github.io/docs/wasm-bindgen/) — Rust↔JS interop
- [`wasm-pack` docs](https://rustwasm.github.io/docs/wasm-pack/) — WASM build tool
