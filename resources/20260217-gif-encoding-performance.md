# GIF Encoding Performance in WASM

## The Problem

Converting images to GIF is significantly slower than converting to other formats (PNG, JPEG, BMP). In testing, a JPEG-to-GIF conversion took ~14 seconds compared to under 1 second for other target formats on the same image.

## Why GIF Is Slow

GIF is limited to a **256-color palette**. When encoding to GIF, the encoder must perform **color quantization** — reducing the full RGB color space (16.7 million colors) down to 256 representative colors. This involves:

1. **Scanning all pixels** to analyze the color distribution of the image.
2. **Building an optimal palette** of 256 colors (typically using the NeuQuant algorithm or median-cut).
3. **Mapping every pixel** to its nearest palette entry.

This is an O(pixels) operation with a high constant factor. For a 12 MP image (4000x3000), that's 12 million pixels being quantized.

By contrast, other target formats don't need this step:

| Format | Encoding approach | Why it's faster |
|--------|-------------------|-----------------|
| **PNG** | Lossless compression of raw pixel data | No color reduction needed |
| **JPEG** | DCT-based lossy compression | Highly optimized codec, no palette step |
| **BMP** | Uncompressed pixel dump | Virtually no processing |
| **GIF** | Color quantization + palette mapping + LZW compression | Must analyze and remap every pixel |

## Why It's Worse in WASM

The `image` crate's GIF encoder is pure Rust, which is good for WASM compatibility but means:

- **No SIMD** — WASM doesn't use SIMD by default (requires `-C target-feature=+simd128` and browser support)
- **Single-threaded** — WASM runs in a single thread (no `rayon` parallelism)
- **Slower than native** — WASM execution is typically 1.5-3x slower than native Rust

These factors compound to make quantization noticeably slow for large images.

## Mitigation in This Project

Since this is inherent to the GIF format and not fixable at the conversion layer, the UI shows a warning when:
- The target format is GIF, **and**
- The source image is 2+ megapixels

The warning appears as an amber banner: *"GIF encoding requires color quantization (256-color palette). This can be slow for large images."*

This is implemented in `web/src/ui.ts` via the `updateGifWarning()` function, triggered on both file selection and format selector changes.

## Potential Future Improvements

- **SIMD**: Compile with `-C target-feature=+simd128` to speed up quantization on supported browsers
- **Dithering control**: Expose an option to skip dithering (faster but lower visual quality)
- **Pre-quantized path**: For images already having few colors (e.g., screenshots, graphics), quantization is fast — could detect this and skip the warning
- **Alternative quantizers**: Libraries like `imagequant` (used by pngquant) are faster but require C bindings

## References

- `crates/image-converter/src/convert.rs` — Rust conversion logic using `image` crate's `write_to()`
- `web/src/ui.ts` — GIF warning UI logic (`updateGifWarning()`, `GIF_SLOW_THRESHOLD_MP`)
- `web/src/index.html` — `#gif-warning` banner element
- [image crate GIF encoder source](https://github.com/image-rs/image/tree/main/src/codecs/gif.rs)
- [NeuQuant algorithm](https://scientificgems.wordpress.com/stuff/neuquant-fast-high-quality-image-quantization/)
