# Plan: HEIC Image Support (Read-Only, Hybrid JS+Rust)

**Date:** 2026-03-05
**Status:** Completed

## Goal

Add HEIC/HEIF input support to the image converter so users can upload `.heic` files (e.g. from iPhones) and convert them to any supported output format.

## Approach

Hybrid architecture: decode HEIC in JavaScript using the `heic-to` npm package (which wraps libheif compiled to WASM via Emscripten), then pass the resulting PNG bytes into the existing Rust/WASM pipeline unchanged. No Rust code changes are needed.

- **HEIC reading**: JS-side via `heic-to`, lazy-loaded only when a HEIC file is detected
- **HEIC writing**: Not implemented — tooling is immature, codec is GPL/patent-encumbered, user demand is essentially zero
- **Safari 17+ optimisation**: Use native `createImageBitmap()` before falling back to `heic-to` WASM, since iPhone users (primary HEIC source) are disproportionately on Safari

## Critical

- Do **not** add HEIC to the Rust `ImageFormat` enum or `formats.rs` — the `image` crate has no HEIC support and there is no viable Rust crate that compiles to WASM
- Do **not** add `libheif-rs` to `Cargo.toml` — it requires a system `libheif-dev` library and will fail to compile for `wasm32-unknown-unknown`
- The `heic-to` library **must** be lazy-loaded via dynamic `import()` — at 2–4 MB it must not be bundled for all users
- HEIC is an input-only pre-processing step — all actual encoding is handled by the existing Rust pipeline

## Steps

1. Install `heic-to` npm package in `web/`
2. Create `web/src/lib/heic.ts` with:
   - `isHeicMagicBytes(bytes)` — fast magic-byte check (no library load)
   - `normalizeHeic(file)` — detects HEIC, lazy-loads `heic-to`, decodes to PNG `File`; uses native `createImageBitmap()` on Safari 17+ first
3. Integrate `normalizeHeic` into `useConverter.ts` `handleFile` — call it before reading bytes, so the rest of the pipeline sees a plain PNG
4. Update `MIME_TYPES` and `ValidFormat` if needed to surface "heic" as an accepted input type in the UI
5. Update `DropZone` accepted file types to include `.heic` / `.heif`
6. Write unit tests in `web/tests/unit/heic.test.ts` (magic byte detection, pass-through for non-HEIC)
7. HEIC integration tests live in `web/tests/e2e/conversion.spec.ts` alongside other e2e tests; fixture at `web/tests/fixtures/sample.heic`

## TODOs

- [x] Install `heic-to` in `web/` (`npm install heic-to`)
- [x] Create `web/src/lib/heic.ts`
  - [x] `isHeicMagicBytes` helper
  - [x] `normalizeHeic` with lazy import + Safari 17+ native path
- [x] Integrate `normalizeHeic` in `useConverter.ts` `handleFile`
- [x] Update `DropZone` to accept `.heic` / `.heif` file extensions
- [x] Add `heic` / `heif` to MIME type accept list where file inputs are defined
- [x] Write unit tests — `web/tests/unit/heic.test.ts`
- [x] Add `web/tests/fixtures/sample.heic` fixture — integration tests in `web/tests/e2e/conversion.spec.ts`
- [x] Manually test on Chrome (WASM path) and Safari 17+ (native path)
- [x] Check bundle size impact after `npm run build`

## Open Questions

1. **Does `heic-to` v1.4.x automatically use Safari 17+ native decode or always loads WASM?**
   - **Resolved:** `heic-to` always loads its own WASM — it has no awareness of browser capabilities. This is already handled correctly: `tryNativeDecode` via `createImageBitmap()` is attempted first in `heic.ts`, and `heic-to` is only imported if that returns `null`. On Safari 17+, `heic-to` is never loaded at all.

2. **Exact uncompressed WASM binary size for `heic-to` v1.4.x**
   - **Resolved:** Per `bundle-sizes.md` (2026-03-06): `heic-to` chunk is **2,729 kB raw / 657.9 KB gzipped**. It is a separate lazy chunk and is not included in the main app bundle.

3. **CSP implications**
   - **Resolved:** No CSP headers are set anywhere in the project — no `web/public/_headers` file exists, and `astro.config.ts` has no CSP configuration. `static/` only contains `robots.txt` and `sitemap.xml`. This is a non-issue.

## Implementation Discoveries

- **jsdom incompatibility with Node 20.16**: jsdom 28 requires Node ≥20.19. Vitest was configured with `environment: 'node'` instead — `File` and `Uint8Array` are available natively in Node 20+, so all tests work without jsdom.
- **heic-to is a dependency, not devDependency**: The dynamic import in `heic.ts` means Vite bundles it as a separate lazy chunk. It must be in `dependencies`, not `devDependencies`.
- **Vite correctly code-splits heic-to**: The dynamic `import('heic-to')` in `heic.ts` results in a separate `heic-to.*.js` chunk (2,729 kB / 671 kB gzipped). It is NOT included in the main app bundle. Vite emits a chunk size warning, which is expected and acceptable.
- **`file` reference in `fileInfo.file` kept as original**: The normalised `File` is used only for reading bytes. The original `file` is retained in `fileInfo.file` so that `file.name` and `file.size` remain correct for download filenames and analytics.
- **Source format displays as PNG for HEIC uploads**: After normalisation, `detectFormat(bytes)` sees PNG bytes and reports `png`. This is an acceptable UI tradeoff — there is no way to report `heic` without adding it to the Rust pipeline.

## Verification

- [x] **Unit: magic byte detection** — `isHeicMagicBytes` returns `true` for HEIC headers, `false` for PNG/JPEG/WebP — 8 tests passing (`npm test` in `web/`)
- [x] **Unit: pass-through** — `normalizeHeic(pngFile)` returns the original file unchanged — 3 tests passing
- [x] **Integration: HEIC → PNG normalisation** — covered by `conversion.spec.ts` ("HEIC upload: file is decoded and source info appears") using `web/tests/fixtures/sample.heic`
- [x] **Integration: full pipeline** — covered by `conversion.spec.ts` ("HEIC → JPEG: full pipeline produces valid JPEG blob")
- [x] **Safari optimisation** — on Safari 17+, `heic-to` WASM is never loaded (network tab shows no heic-to WASM fetch) — human verification in Safari DevTools
- [x] **Bundle size** — `npm run build` confirms `heic-to` is a separate lazy chunk (2,729 kB), not included in the main app bundle (201 kB)
