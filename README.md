# Rust + WASM Image Converter

A client-side web application that converts images between formats using Rust compiled to WebAssembly. All processing happens in the browser — your images never leave your device.

## Overview

This project pairs a Rust image-processing library (compiled to WASM via `wasm-pack`) with a lightweight TypeScript frontend. A Web Worker keeps the UI responsive during conversion, and transferable objects ensure zero-copy data transfer between threads.

### Why client-side?

Most online image converters upload your files to a server. This tool runs entirely in the browser:

- **Private** — no server uploads, no data collection
- **Fast** — no network round-trip, just local computation
- **Offline-capable** — works without an internet connection (once loaded)

## Features

- **Format conversion** — convert between 10 image formats (see table below)
- **Image transforms** — flip horizontal/vertical, rotate 90/180/270 degrees, grayscale, invert
- **EXIF & metadata** — view camera info, GPS coordinates, PNG text chunks, ICC profiles
- **Quality control** — adjustable quality slider (1-100%) for JPEG and PNG
- **Clipboard paste** — paste images directly from the clipboard
- **Benchmark mode** — compare conversion performance across all output formats
- **HEIC support** — auto-converts HEIC/HEIF input to PNG via a lazy-loaded WASM decoder

## Supported Formats

| Format    | Input | Output | Notes                                    |
|-----------|-------|--------|------------------------------------------|
| PNG       | Yes   | Yes    | Compression level via quality slider     |
| JPEG      | Yes   | Yes    | Quality parameter via quality slider     |
| WebP      | Yes   | No     | Decode only — encoding not supported     |
| GIF       | Yes   | Yes    |                                          |
| BMP       | Yes   | Yes    |                                          |
| TIFF      | Yes   | Yes    |                                          |
| ICO       | Yes   | Yes    |                                          |
| TGA       | No    | Yes    | No magic bytes — cannot auto-detect      |
| QOI       | Yes   | Yes    |                                          |
| HEIC/HEIF | Yes   | No     | Input only — converted to PNG for output |

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Browser                                             │
│                                                      │
│  ┌────────────────────┐    ┌──────────────────────┐  │
│  │  Astro + Preact    │───>│   Web Worker         │  │
│  │  (Vite bundled)    │<───│                      │  │
│  │                    │    │  ┌────────────────┐  │  │
│  │  - Drag & drop     │    │  │  Rust WASM     │  │  │
│  │  - Format selector │    │  │  Module         │  │  │
│  │  - Quality slider  │    │  │                │  │  │
│  │  - Transforms      │    │  │  image crate   │  │  │
│  │  - EXIF viewer     │    │  │  kamadak-exif  │  │  │
│  │  - Preview         │    │  └────────────────┘  │  │
│  │  - Benchmark       │    │                      │  │
│  └────────────────────┘    └──────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

- **Rust WASM library** — image decoding, encoding, format detection, transforms, and EXIF extraction via the `image` and `kamadak-exif` crates
- **Web Worker** — runs WASM off the main thread so the UI stays responsive
- **Astro + Preact frontend** — TypeScript with Tailwind CSS v4, bundled by Vite

### Worker–Main Thread Communication

All WASM operations run inside a Web Worker. The main thread (`main.ts`) communicates with the Worker (`worker.ts`) via a structured message protocol using `postMessage`. Each request carries a numeric ID so the main thread can match responses back to the correct pending Promise.

#### Initialization

```
  main.ts                              worker.ts
    │                                     │
    │  new Worker()                       │
    │────────────────────────────────────▶│
    │                                     │  await init()  ──▶  WASM loads
    │                                     │
    │      { type: Init, success, initMs }│
    │◀────────────────────────────────────│
    │                                     │
    │  resolveInit(initMs)                │
    │  ready promise fulfilled            │
    │                                     │
```

The Worker is created eagerly on page load. It calls the wasm-pack `init()` function immediately and posts back the initialization result with timing.

All WASM operations use the same request/response pattern: the main thread sends a message with a numeric ID, the Worker processes it and posts back a response keyed to that ID.

**Message types**: `Init`, `DetectFormat`, `ConvertImage`, `GetDimensions`, `GetMetadata`, `BenchmarkImages`

Input data is **copied** to the Worker (default `postMessage` behavior) so the caller retains the original bytes. Output data is **transferred** back via `[result.buffer]` (zero-copy, O(1) regardless of size).

If a WASM call throws, the Worker sends an `Error` response with the original request ID, and the main thread rejects the corresponding Promise. If the Worker itself crashes, `onerror` rejects the init promise and all pending requests.

## How to Use

1. Open the app in your browser
2. Drop an image file, click to browse, or paste from clipboard — the source format is auto-detected
3. Select a target format (4 primary formats shown, expand for TIFF/ICO/TGA/QOI)
4. Optionally adjust the quality slider (JPEG, PNG) or apply transforms (flip, rotate, grayscale, invert)
5. Click **Convert**
6. Preview the result, view EXIF metadata, and click **Download**

### Limits

- Maximum file size: **200 MB**
- Maximum image dimensions: **100 megapixels**

## Development

### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)
- [Node.js](https://nodejs.org/) (v18+)

```bash
# One-time setup
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
```

### Build & Run

```bash
# Build WASM module
wasm-pack build crates/image-converter --target web --release

# Install frontend dependencies & start dev server
cd web && npm install && npm run dev

# Or build WASM + start dev in one step
cd web && npm run dev:full
```

### Deploy to Cloudflare Pages

A `build.sh` script at the repo root handles the full build from scratch:

```bash
# Deploy from the repo root
npx wrangler pages deploy web/dist
```

Configure Cloudflare Pages with:
- **Root directory**: *(leave blank — repo root)*
- **Build command**: `bash build.sh`
- **Output directory**: `web/dist`

The script installs Rust if not present, adds the `wasm32-unknown-unknown` target, installs npm dependencies (which includes `wasm-pack`), builds the WASM module, then runs the Astro build.

### Testing

#### Rust

```bash
# Unit tests
cargo test --manifest-path crates/image-converter/Cargo.toml

# With conversion timings visible
cargo test --manifest-path crates/image-converter/Cargo.toml -- --nocapture

# Sequential output (avoids interleaved timing lines)
cargo test --manifest-path crates/image-converter/Cargo.toml -- --nocapture --test-threads=1

# Run the large-image tests (100 MP / 10000x10000, ~400 MB per buffer)
cargo test --manifest-path crates/image-converter/Cargo.toml -- --ignored --nocapture size_square_max

# Run a single large-image test by format
cargo test --manifest-path crates/image-converter/Cargo.toml -- --ignored --nocapture size_square_max_gif

# WASM tests (headless browser)
wasm-pack test --headless --chrome crates/image-converter
```

#### TypeScript — Unit (Vitest)

```bash
# Run unit tests
cd web && npm test

# Run with UI
cd web && npx vitest --ui
```

#### TypeScript — E2E (Playwright)

```bash
# Run all E2E tests
cd web && npm run test:e2e

# Run a specific spec file
cd web && npx playwright test tests/e2e/conversion.spec.ts

# Run a specific test by name
cd web && npx playwright test --grep "WASM initializes"

# Run with browser visible
cd web && npx playwright test --headed

# Show HTML report after a run
cd web && npx playwright show-report
```

#### All Tests

```bash
# Run Rust + Vitest + Playwright in sequence
cd web && npm run tests
```

### Benchmarks

Performance benchmarks use [Criterion](https://bheisler.github.io/criterion.rs/book/) to measure conversion time across all format pairs and image sizes. See [`resources/20260218-cargo-bench-and-criterion.md`](resources/20260218-cargo-bench-and-criterion.md) for a deeper explanation of how `cargo bench` and Criterion work.

```bash
# Run all benchmarks
cargo bench --bench conversion_bench

# Run benchmarks for a specific image size
cargo bench --bench conversion_bench -- 'convert_100x100'
cargo bench --bench conversion_bench -- 'convert_1920x1080'
cargo bench --bench conversion_bench -- 'convert_4000x3000'

# Run benchmarks for a specific source format
cargo bench --bench conversion_bench -- 'from_PNG'

# Save a named baseline (e.g., before a refactor)
cargo bench --bench conversion_bench -- --save-baseline before-refactor

# Compare against a saved baseline
cargo bench --bench conversion_bench -- --baseline before-refactor
```

After running benchmarks, open the HTML report for detailed charts and regression analysis:

```bash
open target/criterion/report/index.html
```

### Linting

```bash
# Format Rust code
cargo fmt

# Run Clippy (all warnings are treated as errors)
cargo clippy -- -D warnings

# TypeScript: type check + ESLint + Prettier in one command
cd web && npm run check:all

# Auto-fix formatting
cd web && npm run format
```

## Project Structure

```
rust-image-tools/
├── Cargo.toml                        # Workspace root
├── crates/
│   └── image-converter/              # Rust WASM library
│       ├── Cargo.toml
│       ├── src/
│       │   ├── lib.rs                # #[wasm_bindgen] exports
│       │   ├── convert.rs            # Core conversion logic
│       │   ├── formats.rs            # Format detection & mapping
│       │   ├── transforms.rs         # Image transform operations
│       │   └── metadata.rs           # EXIF & metadata extraction
│       └── benches/
│           └── conversion_bench.rs   # Criterion performance benchmarks
├── web/                              # Frontend
│   ├── package.json
│   ├── astro.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── pages/
│       │   ├── index.astro           # Homepage with converter + SEO schema
│       │   └── [from]-to-[to].astro  # Dynamic conversion landing pages
│       ├── components/
│       │   ├── ImageConverter.tsx     # Top-level converter container
│       │   ├── DropZone/             # File input, format selector, quality, download
│       │   ├── ImagePreview.tsx      # Side-by-side source/output preview
│       │   ├── TransformToolbar.tsx  # Transform toggle buttons
│       │   ├── TransformModal.tsx    # Full-screen transform editor with undo
│       │   ├── MetadataPanel.tsx     # EXIF & metadata display
│       │   ├── MetadataModal.tsx     # Modal wrapper for metadata
│       │   ├── BenchmarkTable.tsx    # Format comparison results
│       │   └── ProgressBar.tsx       # Conversion progress
│       ├── hooks/                    # useConverter, useBenchmark, useClipboardPaste
│       ├── lib/                      # Worker wrapper, HEIC conversion, quality utils
│       ├── types/                    # Enums, interfaces, type re-exports
│       ├── data/                     # Format pairs & copy for landing pages
│       ├── layouts/
│       │   └── Base.astro            # HTML template, OG tags, JSON-LD schema
│       ├── worker.ts                 # Web Worker for WASM calls
│       └── styles.css                # Global styles
│   └── tests/
│       ├── unit/                     # Vitest unit tests
│       └── e2e/                      # Playwright E2E tests
├── plans/                            # Implementation plans
├── PLANNING.md                       # Architecture & design decisions
└── CLAUDE.md                         # Coding conventions
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Image processing | `image` crate (pure Rust, WASM-compatible) |
| EXIF parsing | `kamadak-exif` |
| Rust-WASM glue | `wasm-bindgen` + `serde-wasm-bindgen` |
| WASM build tool | `wasm-pack` |
| Frontend framework | Astro |
| UI components | Preact |
| Frontend bundler | Vite |
| Styling | Tailwind CSS v4 |
| Unit testing | Vitest |
| E2E testing | Playwright |
| HEIC decoding | `heic-to` (lazy-loaded WASM) |
| Analytics | PostHog |

## License

See [LICENSE](LICENSE) for details.
