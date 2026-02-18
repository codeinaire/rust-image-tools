# Plan: Rust Performance Benchmarks

**Date:** 2026-02-14
**Status:** Done
**PR Scope:** Small-Medium — Criterion setup + benchmark suite
**Depends On:** Plan 03 (Rust test suite — fixtures and test helpers can be reused)

## Goal

Set up Criterion benchmarks for the Rust image conversion library, measuring decode, encode, and total conversion time across all format pairs and image sizes. This provides a performance baseline and catches regressions.

## Approach

Use `criterion` for statistically stable native benchmarks. Benchmarks live in `crates/image-converter/benches/`. Reuse the programmatic fixture generation from Plan 03. Each benchmark measures the full `convert_image()` call, and where practical, separate decode and encode timings.

For WASM-specific benchmarks, use `wasm-pack test` with `performance.now()` — these are less stable than Criterion but give realistic browser-context measurements.

## Steps

1. Add `criterion` as a dev dependency
2. Create benchmark infrastructure in `benches/`
3. Implement conversion matrix benchmarks across image sizes
4. Add structured performance logging to unit tests
5. Verify benchmarks run with `cargo bench`

## Todo

- [x] Add `criterion` dev dependency to `crates/image-converter/Cargo.toml`:
  - [x] `[dev-dependencies] criterion = { version = "0.5", features = ["html_reports"] }`
  - [x] Add `[[bench]]` section: `name = "conversion_bench"`, `harness = false`
- [x] Create `crates/image-converter/benches/conversion_bench.rs`:
  - [x] Import criterion macros and fixture generation helpers
  - [x] Generate test images at benchmark setup (not measured)
- [x] Implement benchmark groups by image size:
  - [x] Small (100x100) — all format pairs
  - [x] Medium (1920x1080) — all format pairs
  - [x] Large (4000x3000) — all format pairs
- [x] Benchmark all format conversion pairs:
  - [x] PNG → JPEG, GIF, BMP
  - [x] JPEG → PNG, GIF, BMP
  - [x] WebP → PNG, JPEG, GIF, BMP
  - [x] GIF → PNG, JPEG, BMP
  - [x] BMP → PNG, JPEG, GIF
- [x] Add performance timing to unit tests (optional, `#[cfg(feature = "bench")]`):
  - [x] Use `std::time::Instant` to measure decode, encode, total
  - [x] Log structured line: `[PERF] PNG → JPEG | WxH | input: X MB | output: X MB | decode: X ms | encode: X ms | total: X ms`
- [x] Run `cargo bench` and verify benchmarks produce results
- [x] Verify Criterion HTML reports are generated in `target/criterion/`
- [x] Add `target/criterion/` to `.gitignore` if not already ignored

## Key Details from PLANNING.md

**Timing breakdown per conversion:**
| Metric | What it measures |
|--------|-----------------|
| `decode` | Time to decode input bytes into raw pixels |
| `encode` | Time to encode raw pixels into target format |
| `total` | Full `convert_image()` call |

**Expected benchmark matrix output:**
| Size | PNG→JPEG | JPEG→PNG | WebP→PNG | BMP→JPEG | ... |
|------|----------|----------|----------|----------|-----|
| 100x100 | 2 ms | 3 ms | 4 ms | 1 ms | |
| 1920x1080 | 77 ms | 120 ms | 95 ms | 65 ms | |
| 4000x3000 | 310 ms | 480 ms | 390 ms | 270 ms | |

**WASM benchmarks (future/optional):**
- Use `wasm-pack test` with `web_sys::window().performance().now()`
- Less stable than Criterion but gives realistic browser-context measurement
