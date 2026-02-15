# Rust + WASM Image Converter

A client-side web application that converts images between formats using Rust compiled to WebAssembly. All processing happens in the browser — your images never leave your device.

## Overview

This project pairs a Rust image-processing library (compiled to WASM via `wasm-pack`) with a lightweight TypeScript frontend. A Web Worker keeps the UI responsive during conversion, and transferable objects ensure zero-copy data transfer between threads.

### Why client-side?

Most online image converters upload your files to a server. This tool runs entirely in the browser:

- **Private** — no server uploads, no data collection
- **Fast** — no network round-trip, just local computation
- **Offline-capable** — works without an internet connection (once loaded)

## Supported Formats

| Format | Input | Output |
|--------|-------|--------|
| PNG    | Yes   | Yes    |
| JPEG   | Yes   | Yes    |
| WebP   | Yes   | No (decode only) |
| GIF    | Yes   | Yes    |
| BMP    | Yes   | Yes    |

## Architecture

```
┌─────────────────────────────────────────────┐
│  Browser                                    │
│                                             │
│  ┌───────────────┐    ┌──────────────────┐  │
│  │  JS Frontend  │───>│   Web Worker     │  │
│  │  (Parcel + TS)│<───│                  │  │
│  │               │    │  ┌────────────┐  │  │
│  │  - File input │    │  │ Rust WASM  │  │  │
│  │  - Format     │    │  │ Module     │  │  │
│  │    selector   │    │  │            │  │  │
│  │  - Preview    │    │  │ image crate│  │  │
│  │  - Download   │    │  └────────────┘  │  │
│  └───────────────┘    └──────────────────┘  │
└─────────────────────────────────────────────┘
```

- **Rust WASM library** — handles image decoding, format detection, and encoding using the `image` crate
- **Web Worker** — runs WASM off the main thread so the UI stays responsive
- **TypeScript frontend** — vanilla TS with Tailwind CSS, bundled by Parcel

## How to Use

1. Open the app in your browser
2. Drop an image file (or click to browse) — the source format is auto-detected
3. Select a target format from the dropdown
4. Click **Convert**
5. Preview the result and click **Download**

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
cd web && npm install && npx parcel src/index.html
```

### Testing

```bash
# Rust unit tests
cargo test --manifest-path crates/image-converter/Cargo.toml

# Rust WASM tests (headless browser)
wasm-pack test --headless --chrome crates/image-converter

# Frontend integration tests
cd web && npx playwright test
```

### Linting

```bash
# Format Rust code
cargo fmt

# Run Clippy (all warnings are treated as errors)
cargo clippy -- -D warnings
```

## Project Structure

```
rust-image-tools/
├── Cargo.toml                      # Workspace root
├── crates/
│   └── image-converter/            # Rust WASM library
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs              # #[wasm_bindgen] exports
│           ├── convert.rs          # Core conversion logic
│           └── formats.rs          # Format detection & mapping
├── web/                            # Frontend
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.html
│       ├── main.ts                 # Entry point
│       ├── worker.ts               # Web Worker for WASM calls
│       ├── ui.ts                   # DOM manipulation
│       └── styles.css
├── plans/                          # Implementation plans
├── PLANNING.md                     # Architecture & design decisions
└── CLAUDE.md                       # Coding conventions
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Image processing | `image` crate (pure Rust, WASM-compatible) |
| Rust-WASM glue | `wasm-bindgen` |
| WASM build tool | `wasm-pack` |
| Frontend bundler | Parcel |
| Frontend language | TypeScript |
| Styling | Tailwind CSS v4 |
| Integration testing | Playwright |

## License

See [LICENSE](LICENSE) for details.
