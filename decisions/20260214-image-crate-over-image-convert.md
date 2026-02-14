# Decision: Use `image` crate over `image-convert`

**Date:** 2026-02-14
**Status:** Accepted

## Context

Evaluated two Rust crates for image format conversion in a client-side WASM web app.

## Options Considered

### `image` crate ([docs](https://docs.rs/image/latest/image/), [GitHub](https://github.com/image-rs/image))

**Pros:**
- Pure Rust — no native/C dependencies, compiles to WASM without issues
- De facto standard image library in Rust (massive community, active maintenance by `image-rs` org)
- Many formats — PNG, JPEG, GIF, TIFF, WebP, QOI, AVIF, BMP, DDS, EXR, HDR, ICO, PNM, TGA
- More than conversion — pixel manipulation, resizing, cropping, color type conversions, filtering
- Granular feature flags — enable only the codecs you need (important for WASM binary size)
- `default-features = false` works cleanly for WASM (avoids `rayon`)
- Well-documented with lots of examples and blog posts

**Cons:**
- Lower-level — you wire up the encode/decode pipeline yourself
- Resizing quality is decent but not ImageMagick-tier
- Some format support is decode-only

### `image-convert` crate ([docs](https://docs.rs/image-convert/latest/image_convert/))

**Pros:**
- Higher-level API — simple calls like `to_png()` with config objects
- ImageMagick backend (`magick_rust` / MagickWand) — battle-tested, excellent resize quality
- Interlacing support built in
- Image identification — extract metadata easily

**Cons:**
- Requires ImageMagick as a native C dependency — **cannot compile to WASM** (dealbreaker)
- Fewer supported output formats — only 9 (BMP, JPG, PNG, GIF, TIFF, WEBP, ICO, PGM, GrayRaw)
- Much smaller community — fewer downloads, less active maintenance
- Heavy dependency — pulling in ImageMagick adds complexity to builds and CI
- Focused on conversion only — no pixel manipulation, filtering, or compositing

## Decision

**Chosen: `image` crate.**

The `image-convert` crate wraps ImageMagick via C bindings, which cannot compile to WebAssembly — making it a non-starter for a client-side browser app. The `image` crate is pure Rust, compiles cleanly to WASM, and provides a foundation to expand into resizing, cropping, filters, and other features down the road.
