# Plan: Rust Performance Benchmarks

**Date:** 2026-02-14
**Status:** Draft
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

- [ ] Add `criterion` dev dependency to `crates/image-converter/Cargo.toml`:
  - [ ] `[dev-dependencies] criterion = { version = "0.5", features = ["html_reports"] }`
  - [ ] Add `[[bench]]` section: `name = "conversion_bench"`, `harness = false`
- [ ] Create `crates/image-converter/benches/conversion_bench.rs`:
  - [ ] Import criterion macros and fixture generation helpers
  - [ ] Generate test images at benchmark setup (not measured)
- [ ] Implement benchmark groups by image size:
  - [ ] Small (100x100) — all format pairs
  - [ ] Medium (1920x1080) — all format pairs
  - [ ] Large (4000x3000) — all format pairs
- [ ] Benchmark all format conversion pairs:
  - [ ] PNG → JPEG, GIF, BMP
  - [ ] JPEG → PNG, GIF, BMP
  - [ ] WebP → PNG, JPEG, GIF, BMP
  - [ ] GIF → PNG, JPEG, BMP
  - [ ] BMP → PNG, JPEG, GIF
- [ ] Add performance timing to unit tests (optional, `#[cfg(feature = "bench")]`):
  - [ ] Use `std::time::Instant` to measure decode, encode, total
  - [ ] Log structured line: `[PERF] PNG → JPEG | WxH | input: X MB | output: X MB | decode: X ms | encode: X ms | total: X ms`
- [ ] Run `cargo bench` and verify benchmarks produce results
- [ ] Verify Criterion HTML reports are generated in `target/criterion/`
- [ ] Add `target/criterion/` to `.gitignore` if not already ignored

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
