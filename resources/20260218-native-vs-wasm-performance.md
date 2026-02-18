# Native Rust vs WASM Performance

Rust code compiled to native (via `cargo bench`) runs significantly faster than the same code compiled to WebAssembly and executed in a browser. Understanding this gap is important for setting realistic performance expectations and calibrating the frontend's estimated progress bar.

## Why It Matters for This Project

The Criterion benchmarks measure native Rust performance, but users experience WASM performance in the browser. These are very different numbers. For example:

| Measurement | JPEG→PNG (4000x3000) | Context |
|-------------|---------------------|---------|
| Criterion (native) | ~75 ms | Blank test image, native compilation |
| Browser (WASM) | ~413 ms | Real photo, WASM + full pipeline |

The progress bar estimation model in the frontend uses `ms_per_mp` values per format pair. These must be calibrated from **real browser timings**, not native benchmarks.

## Sources of the Performance Gap

### 1. Native vs WASM Compilation (~1.5-3x)

This is the largest factor. Native compilation targets your CPU directly (x86_64 or ARM64) with full access to:

- **SIMD instructions** — WASM doesn't use SIMD by default (requires explicit `-C target-feature=+simd128` and browser support)
- **CPU-specific optimizations** — native `opt-level = "s"` or `opt-level = 3` can use AVX2, NEON, etc.
- **Direct memory access** — WASM uses linear memory with bounds checking on every access
- **No sandboxing overhead** — WASM runs in a sandbox with additional safety checks

A 2-3x slowdown from native to WASM is typical for compute-heavy workloads like image processing.

### 2. Test Image Content

Criterion benchmarks generate blank (zero-filled) images. These have uniform pixel data that:

- Compresses trivially (PNG, GIF)
- Decodes with minimal work
- Produces tiny encoded output

Real photographs have complex, high-entropy pixel data that takes significantly more CPU time to decode and encode. This can easily account for a 2-5x difference depending on the format and compression level.

### 3. Frontend Pipeline Overhead

The browser timing includes the full conversion pipeline, not just the WASM `convert_image()` call:

```
Total browser time = data copy to Worker (postMessage)
                   + JS→WASM boundary crossing
                   + WASM decode
                   + WASM encode
                   + WASM→JS boundary crossing
                   + data transfer back (transferable, but still has overhead)
                   + Blob creation for preview
```

The Worker data copy is the main overhead — `postMessage` copies the full image buffer to the Worker's memory space. The transfer back uses transferable objects (zero-copy), so it's fast.

### 4. Memory Allocation Patterns

WASM's linear memory uses `memory.grow()` to allocate, which is slower than native `malloc`/`mmap`. Image processing allocates large buffers (decoded RGBA = W × H × 4 bytes), so allocation overhead is noticeable for large images.

## Practical Implications

### For Benchmarking

- **Criterion benchmarks are useful for relative comparisons** — comparing format pairs, detecting regressions, measuring the impact of code changes
- **Criterion benchmarks are NOT useful for absolute timing predictions** — don't use native numbers to estimate browser performance
- **For realistic benchmarks**, load real photo files as fixtures instead of generating blank images

### For Progress Bar Calibration

The frontend's estimated progress bar model:

```
estimated_ms = base_ms[format_pair] + (megapixels * ms_per_mp[format_pair])
```

These values should be calibrated from real browser `performance.now()` measurements, not Criterion output. The PostHog `conversion_completed` event captures `conversion_ms` which can be used to refine these estimates over time with real user data.

### For Future Optimization

Potential ways to close the native-WASM gap:

| Optimization | Expected Impact | Complexity |
|-------------|----------------|------------|
| Enable WASM SIMD (`+simd128`) | 10-40% faster for pixel ops | Low (compile flag) |
| Use `wasm-opt -O3` post-processing | 5-15% faster | Low (build step) |
| Real photo test fixtures in Criterion | More realistic baseline numbers | Low |
| Memory64 (wasm64) | Removes 4GB limit, but 10-100% slower | High (no Safari support) |
| Tiled/streaming processing | Reduces peak memory, may improve cache behavior | High |

## References

- [WebAssembly performance characteristics](https://webassembly.org/docs/use-cases/)
- [wasm-bindgen performance tips](https://rustwasm.github.io/docs/book/game-of-life/implementing.html)
- [Chrome WASM SIMD support](https://v8.dev/features/simd)
- Progress bar estimation model: `PLANNING.md` (lines 240-263)
- PostHog conversion timing: `PLANNING.md` (lines 564-577)
- Project benchmarks: `crates/image-converter/benches/conversion_bench.rs`
