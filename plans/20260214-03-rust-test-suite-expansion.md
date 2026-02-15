# Plan: Rust Test Suite Expansion

**Date:** 2026-02-14
**Status:** Draft
**PR Scope:** Medium — comprehensive test coverage for the Rust library
**Depends On:** Plan 02 (core conversion + dimension reading)

## Goal

Build out the full Rust unit test suite covering the conversion matrix, image size variants, error cases, pixel fidelity, and format detection edge cases. Test fixtures are generated programmatically (not checked in as binaries).

## Approach

Tests live in `#[cfg(test)]` modules at the bottom of each source file, plus integration-style tests in `tests/` for the full conversion matrix. Fixtures are generated at test time using the `image` crate to create synthetic images. The "Square max" (100 MP) test is marked `#[ignore]` due to memory requirements.

## Steps

1. Create test helper for programmatic fixture generation (creates minimal valid images in each format at various sizes)
2. Implement full format conversion matrix tests (every input→output pair)
3. Implement image size variant tests (1x1, 100x100, 1920x1080, 4000x3000, wide, tall, square max)
4. Implement error case tests (empty input, truncated, random bytes, unsupported format, invalid format string)
5. Implement pixel fidelity tests (lossless round-trips, alpha channel preservation)
6. Implement dimension reading edge case tests (unusual aspect ratios, corrupted headers)
7. Verify all tests pass with `cargo test`

## Todo

- [x] Create test helper module/function to generate synthetic test images programmatically
- [x] Generate fixtures: tiny (1x1), small (100x100), medium (1920x1080), large (4000x3000), wide (10000x100), tall (100x10000)
- [x] Write conversion matrix tests — all 16 input→output combinations:
  - [x] PNG → JPEG, GIF, BMP
  - [x] JPEG → PNG, GIF, BMP
  - [x] WebP → PNG, JPEG, GIF, BMP
  - [x] GIF → PNG, JPEG, BMP
  - [x] BMP → PNG, JPEG, GIF
- [x] Each conversion test verifies: output is valid (re-decodable), output format matches target, dimensions preserved
- [x] Write size variant tests for key conversion paths across all image sizes
- [x] Write `#[ignore]` test for square max (10000x10000 / 100 MP) with note about CI-only
- [x] Write error case tests:
  - [x] Empty input (`&[]`) → meaningful error
  - [x] Truncated file (first 100 bytes of valid PNG) → decode error
  - [x] Random bytes (`&[u8; 1024]`) → unrecognized format error
  - [x] Unsupported output format (`"avif"`) → unsupported format error
  - [x] Invalid format string (`"notaformat"`) → unsupported format error
- [x] Write pixel fidelity tests:
  - [x] PNG→PNG round-trip: pixel-perfect
  - [x] BMP→PNG round-trip: pixel-perfect
  - [x] JPEG→PNG: dimensions preserved (no pixel-perfect check for lossy source)
  - [x] Alpha channel preserved in PNG→PNG, PNG→GIF
- [x] Write dimension reading tests:
  - [x] Correct dimensions for each format
  - [x] Correct dimensions for unusual aspect ratios (wide, tall)
  - [x] Error on corrupted/truncated headers
- [x] Run `cargo fmt`, `cargo clippy`, `cargo test`
- [x] Verify all non-ignored tests pass

## Key Details from PLANNING.md

**Conversion matrix:**
| Input↓ / Output→ | PNG | JPEG | GIF | BMP |
|-------------------|-----|------|-----|-----|
| PNG | - | T | T | T |
| JPEG | T | - | T | T |
| WebP | T | T | T | T |
| GIF | T | T | - | T |
| BMP | T | T | T | - |

**Image size variants:**
| Category | Dimensions | Purpose |
|----------|-----------|---------|
| Tiny | 1x1 | Edge case |
| Small | 100x100 | Fast baseline |
| Medium | 1920x1080 | Typical photo |
| Large | 4000x3000 | High-res |
| Wide | 10000x100 | Unusual aspect ratio |
| Tall | 100x10000 | Unusual aspect ratio |
| Square max | 10000x10000 | At dimension limit (`#[ignore]`) |

**Test fixtures:** Generated programmatically, not checked in as binaries.
