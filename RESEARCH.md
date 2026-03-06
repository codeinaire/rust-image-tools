# HEIC/HEIF Support in Rust/WASM - Research

**Researched:** 2026-03-05
**Domain:** HEIC/HEIF image format support in Rust compiled to WebAssembly
**Confidence:** HIGH (core findings), MEDIUM (binary size estimates), LOW (pure-Rust encoding)

---

## Summary

HEIC/HEIF is a fundamentally difficult format to support in a browser WASM context. The underlying
codec (HEVC/H.265) is patent-encumbered, which has blocked pure-Rust implementations and caused
major projects (wasm-vips, Sharp, NetVips) to explicitly exclude HEIC from their pre-built
binaries. There is no native HEIC support in the `image` crate and none is planned.

The only viable path to HEIC *decoding* in a browser is using `libheif` (a C++ library) compiled
to WebAssembly via Emscripten. Several JS/WASM npm packages wrap this already. These packages weigh
approximately 2–4 MB for the WASM binary, which is non-trivial but accepted in production
applications. HEIC *encoding* in the browser is theoretically possible using kvazaar (LGPL) or
x265 (GPL) via the same pipeline, but the encoded binary would be significantly larger and no
well-maintained off-the-shelf npm package does this reliably.

**Primary recommendation:** Add HEIC *reading* only, using a hybrid architecture: handle HEIC
decode in JavaScript (via `libheif-js` or `heic-to` npm packages) before the WASM boundary, then
hand raw RGBA pixels into the existing Rust/WASM pipeline for re-encoding to any target format. Do
not attempt to write HEIC output — the tooling is immature, the codec is GPL/patent-encumbered, and
user demand for "convert to HEIC" is essentially zero.

---

## Standard Stack

### Core (for the recommended hybrid approach)

| Library | Version | Purpose | License | Maintained? | Why Standard |
|---------|---------|---------|---------|-------------|--------------|
| `heic-to` (npm) | 1.4.2 | HEIC decode to JPEG/PNG in browser | MIT | Yes (Feb 2026) | Actively follows libheif releases, 297 stars, 220 dependents |
| `libheif-js` (npm) | 1.19.8 | Lower-level libheif WASM binding | LGPL-3.0 | Yes | Official Emscripten build from libheif's own authors |
| Existing Rust `image` crate | 0.25 | All other format encode/decode | MIT/Apache-2.0 | Yes | Already in project, no change needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|-----------|-----------|----------|
| `heic-to` (JS) | `libheif-rs` (Rust) | `libheif-rs` requires a system `libheif-dev` C library — cannot be compiled to `wasm32-unknown-unknown` |
| `heic-to` (JS) | `@saschazar/wasm-heif` | Last updated 5 years ago, decode-only, abandoned |
| `heic-to` (JS) | `elheif` | Supports encode + decode, but niche/low adoption, no clear maintenance timeline |
| JS-side decode | Rust-side decode | No viable pure-Rust HEIC decoder exists as of March 2026 |

### Installation (for recommended hybrid approach)

```bash
# In the web/ directory
npm install heic-to
# OR for lower-level access:
npm install libheif-js
```

No changes to `crates/image-converter/Cargo.toml` are needed for the recommended approach.

---

## Architecture Options

Fundamental approaches to the problem — choose one before writing code.

| Option | Description | Pros | Cons | Best When |
|--------|-------------|------|------|-----------|
| **A. Hybrid JS+Rust (recommended)** | JS detects HEIC, decodes via `heic-to`/`libheif-js` to raw RGBA, passes pixels into existing `decode_to_rgba` / `convert_image` flow | No Rust changes; works in all browsers; reuses existing pipeline | 2–4 MB additional JS/WASM payload; extra JS↔WASM boundary crossing for HEIC files only | This project — Rust/WASM is already the core; HEIC is an input-only edge case |
| **B. Rust via `libheif-rs`** | Add `libheif-rs` Rust crate, call it from `convert.rs` | Keeps all logic in Rust | **Blocked**: `libheif-rs` requires `libheif-dev` system library, cannot compile to `wasm32-unknown-unknown` | Native desktop tools only |
| **C. Emscripten-compiled libheif as Rust dependency** | Compile `libheif` C++ to WASM, link into Rust WASM binary | Single `.wasm` file | Extremely complex build; no established path via `wasm-pack`; bloats WASM binary by 3–5 MB | Greenfield project with a dedicated build engineer |
| **D. No HEIC support** | Reject HEIC uploads with a user-friendly error | Zero complexity, zero risk | Users with iPhone photos cannot convert | Explicitly not wanted |

**Recommended:** Option A (Hybrid JS+Rust) — it is the only approach that is both technically
feasible today and maintainable without a dedicated Emscripten build pipeline.

---

## Architecture Patterns

### Recommended Project Structure Changes

```
web/src/
├── lib/
│   └── heic.ts           # NEW: HEIC detection + decode-to-RGBA wrapper
├── components/
│   └── DropZone/
│       └── index.tsx     # MODIFIED: add HEIC pre-processing before WASM call
crates/image-converter/
└── src/
    ├── lib.rs            # No changes needed
    ├── formats.rs        # No changes needed (HEIC stays out of the enum)
    └── convert.rs        # No changes needed
```

HEIC is treated as an *input-only pre-processing step* that produces RGBA pixels, which then feed
into the existing `decode_to_rgba` / `convert_image` pipeline unchanged.

### Pattern 1: JS-Side HEIC Detection and Pre-Decode

**What:** Before calling the Rust WASM module, check if the file is HEIC. If so, use `heic-to` to
decode it to raw RGBA bytes, then pass those bytes directly into the format-agnostic convert path.

**When to use:** Any time a user drops or uploads a HEIC file.

**Example (TypeScript):**
```typescript
// web/src/lib/heic.ts
// Source: heic-to npm package API (https://github.com/hoppergee/heic-to)

import { isHeic, heicTo } from "heic-to";

/**
 * If the file is HEIC/HEIF, decode it to a PNG Blob that the Rust WASM
 * pipeline can handle. Otherwise, return the original file unchanged.
 */
export async function normalizeHeic(file: File): Promise<File> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const heic = await isHeic(bytes);
  if (!heic) {
    return file;
  }

  // Decode HEIC → PNG blob (PNG is lossless and universally supported by our Rust pipeline)
  const pngBlob = await heicTo({
    blob: file,
    type: "image/png",
    quality: 1,
  });

  return new File([pngBlob], file.name.replace(/\.heic$/i, ".png"), {
    type: "image/png",
  });
}
```

**Integration point in DropZone/ImageConverter:**
```typescript
// Before calling convertImage(bytes, targetFormat) in the existing flow:
const normalized = await normalizeHeic(originalFile);
const bytes = new Uint8Array(await normalized.arrayBuffer());
// Then proceed with existing WASM call — no Rust changes needed
const result = convertImage(bytes, targetFormat);
```

### Pattern 2: Lazy-Load the HEIC Library

**What:** Import `heic-to` dynamically only when a HEIC file is detected, so non-HEIC users do not
pay the 2–4 MB download cost.

**When to use:** Always — this is not optional given the payload size.

**Example:**
```typescript
// Dynamic import — only loads libheif WASM if the user actually uploads a HEIC file
export async function normalizeHeicLazy(file: File): Promise<File> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Fast magic-byte check without importing heic-to
  const isHeicMagic = isHeicMagicBytes(bytes);
  if (!isHeicMagic) {
    return file;
  }

  // Only now do we load the 2–4 MB heic-to library
  const { isHeic, heicTo } = await import("heic-to");

  const confirmed = await isHeic(bytes);
  if (!confirmed) {
    return file;
  }

  const pngBlob = await heicTo({ blob: file, type: "image/png", quality: 1 });
  return new File([pngBlob], file.name.replace(/\.heic$/i, ".png"), {
    type: "image/png",
  });
}

/**
 * Fast HEIC magic byte check — avoids loading the library for clearly non-HEIC files.
 * HEIF files start with a 4-byte size field, then "ftyp", then brand codes like
 * "heic", "heix", "hevc", "hevx", "mif1", "msf1".
 */
function isHeicMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  if (ftyp !== "ftyp") return false;
  const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  return ["heic", "heix", "hevc", "hevx", "mif1", "msf1", "MiHE"].includes(brand);
}
```

### Anti-Patterns to Avoid

- **Adding `heic` to the Rust `ImageFormat` enum:** The `image` crate has no HEIC support and there
  is no viable Rust crate that compiles to WASM. Adding it to the enum would create dead code and
  confusion about what the WASM module actually handles.
- **Adding `libheif-rs` to `Cargo.toml`:** It requires a system `libheif-dev` installation and
  links via `pkg-config`. It will fail to compile for the `wasm32-unknown-unknown` target.
- **Loading the HEIC library eagerly:** At 2–4 MB of WASM binary, loading it for every user
  regardless of whether they upload HEIC is a major performance regression.
- **Attempting HEIC encoding (output):** x265 is GPL, kvazaar adds complexity, and no user
  scenario meaningfully requires producing a HEIC file from a web app. AVIF is the HEVC-free
  alternative for high-compression output.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HEIC magic byte parsing | Custom byte inspector | `isHeic()` from `heic-to` | Handles all HEIF brand codes including edge cases like `MiHE`, multi-image HEIC |
| HEVC decoding | Any Rust implementation | `heic-to` / `libheif-js` (JS) | HEVC has 7,200+ patents; libheif's C++ implementation has been legally vetted and is in production across millions of apps |
| HEIC format detection on the Rust side | Byte inspection in Rust | JS-side detection before WASM | Avoids shipping HEVC codec parsing logic into the WASM binary |

---

## Common Pitfalls

### Pitfall 1: Assuming `libheif-rs` is WASM-Compatible

**What goes wrong:** Developer adds `libheif-rs` to `Cargo.toml` and runs `wasm-pack build`.
The build fails immediately because `libheif-sys` calls `pkg-config` to find the system `libheif`
library, which does not exist in the `wasm32-unknown-unknown` target environment.

**Why it happens:** `libheif-rs` is a safe Rust wrapper around a native C library binding
(`libheif-sys`). It uses `pkg-config` for library discovery at build time. This is fundamentally
incompatible with cross-compilation to WASM.

**How to avoid:** Only the JS/npm path can bring libheif into a browser context. If you want
Rust-based HEIC decoding, it requires a native binary (not WASM) and a server-side architecture.

### Pitfall 2: Eager Loading Causes 3–4 MB Upfront Penalty

**What goes wrong:** `import { heicTo } from "heic-to"` at the top of a component causes Vite to
bundle or eagerly load the WASM binary for every user on page load, regardless of whether they
ever upload a HEIC file. Since iPhone users are the primary HEIC source and they use Safari (which
already has native HEIC support), many users are paying this cost for nothing.

**How to avoid:** Use dynamic `import()` gated behind a HEIC magic-byte check. See Pattern 2 above.

### Pitfall 3: Patent and License Exposure

**What goes wrong:** Developer uses `elheif` or a custom Emscripten build that includes `x265`.
The `x265` encoder is GPL-licensed. Distributing a web app that bundles GPL code requires making
your own application GPL-licensed or obtaining a commercial license.

**Why it happens:** HEVC encoding has no free/open-source encoder with a permissive license.
kvazaar is LGPL (safer) but building it via Emscripten requires a custom build pipeline.

**How to avoid:** Restrict HEIC to *reading only*. For HEIC decode, libheif itself is LGPL, which
is generally safe for web distribution. `heic-to` is MIT-licensed. Verify with legal counsel before
shipping HEIC *encoding* in a commercial product.

### Pitfall 4: Safari Already Handles HEIC Natively

**What goes wrong:** Developer ships the full `heic-to` library for all users, not realizing that
Safari 17+ can natively decode HEIC via `createImageBitmap()` or `<img>` tags. Safari users (the
most common HEIC source, since they use iPhones) pay a 2–4 MB download penalty for something their
browser already does.

**Why it happens:** HEIC browser support is Safari-only, but HEIC file creation is primarily
iPhone-driven, so Safari users are the *primary* HEIC use case.

**How to avoid:** Implement a two-tier decode strategy:
1. If `createImageBitmap()` returns successfully for HEIC input (Safari 17+), use that result.
2. Otherwise, fall back to `heic-to` WASM decode.

Production apps report that Safari 17.6+ native decoding is 17–39x faster than any JS/WASM
approach. The native path also avoids downloading the library entirely.

### Pitfall 5: Multi-Image HEIC Bursts

**What goes wrong:** iPhone "Live Photos" and burst shots produce HEIC files containing multiple
images. Naive implementations extract only the first image. Users are confused when their burst
sequence collapses to a single frame.

**Why it happens:** The HEIF container format supports multiple images. Most simple demos only
show how to decode `data[0]`.

**How to avoid:** For a converter app, extracting only the primary/first image (the "still" from a
Live Photo) is usually correct. Document this behavior explicitly in the UI.

---

## HEIC/HEIF Format Technical Context

Understanding why this is hard helps avoid future dead-ends.

| Property | Value |
|----------|-------|
| Container format | ISO Base Media File Format (ISOBMFF) — same as MP4 |
| Image codec | HEVC (H.265) — for still images |
| Patent status | Heavily encumbered — 7,200+ HEVC patents across multiple pools (MPEG LA, HEVC Advance, Velos Media) |
| Royalty-free decode? | Software decoding was made royalty-free by HEVC Advance, but MPEG LA and Velos Media still require licenses |
| Open-source decode | libheif + libde265 (LGPL) — legally available but with caveats |
| Open-source encode | kvazaar (LGPL) or x265 (GPL) — x265 requires commercial license for non-GPL apps |
| Browser support | Safari 17+ only (native). Chrome, Firefox, Edge: none as of March 2026 |
| Alternative | AVIF (uses AV1, royalty-free, supported in Chrome/Firefox/Safari) |

### Why the `image` Crate Will Not Add HEIC

The `image-rs` maintainers closed issue #1375 (HEIC support) because:
1. HEVC is not free to use — no open-source reference implementation exists comparable to AV1/libaom
2. No pure-Rust HEVC decoder exists
3. Adding C library bindings would require a significant architecture change to the crate
4. The project lacks capacity for such a large feature

Source: https://github.com/image-rs/image/issues/1375 (closed, not planned)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-----------------|--------------|--------|
| `heic2any` npm (2.7 MB, slow) | `heic-to` or `libheif-js` with lazy-load | 2023–2024 | 2–3x faster decode, direct ImageData output |
| Always load HEIC library | Load only when HEIC detected | 2024 patterns | Avoids 2–4 MB penalty for non-HEIC users |
| JS-only HEIC decode | Safari 17+: native `createImageBitmap()` | Nov 2023 | 17–39x faster on Safari; no library download |

**Deprecated/outdated:**

- `heic2any`: Still functional but slow and bulky. Superseded by `heic-to` and direct `libheif-js`
  usage.
- `@saschazar/wasm-heif`: Last updated 5 years ago. Do not use for new projects.
- Any approach involving `libheif-rs` in a WASM target: Will not compile. Dead end.

---

## Browser Support Reference

| Browser | HEIC in `<img>` | `createImageBitmap()` HEIC | Notes |
|---------|----------------|--------------------------|-------|
| Safari 17+ | Yes | Yes | Introduced Nov 2023 |
| Safari < 17 | No | No | Need JS/WASM fallback |
| Chrome (all) | No | No | No planned support |
| Firefox (all) | No | No | No planned support |
| Edge (all) | No | No | No planned support |
| Chrome Android | No | No | |
| Safari iOS 17+ | Yes | Yes | iPhone primary HEIC source |

HEIC accounts for approximately 14.31% of global image format usage (driven heavily by iPhone
default camera settings), despite having only ~14% browser support globally.

The key insight: the users *producing* HEIC files (iPhone users) are disproportionately using
Safari, which *already* supports HEIC natively. The remaining cases (Windows/Chrome users receiving
HEIC files from iPhone contacts) are the ones that need the WASM fallback.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Rust: `cargo test` + `wasm-bindgen-test`; TS: none currently |
| Config file | `crates/image-converter/Cargo.toml` (existing) |
| Quick run command | `cargo test --manifest-path crates/image-converter/Cargo.toml` |
| WASM test command | `wasm-pack test --headless --chrome crates/image-converter` |

### Requirements to Test Map

| Requirement | Behavior | Test Type | Automated Command | File Exists? |
|-------------|----------|-----------|-------------------|--------------|
| HEIC magic byte detection | `isHeicMagicBytes()` returns true for HEIC, false for PNG/JPEG | Unit (TS) | Vitest if added | No — needs creating |
| HEIC detection negative | `isHeicMagicBytes()` returns false for PNG, JPEG, WebP headers | Unit (TS) | Vitest if added | No — needs creating |
| HEIC normalizer pass-through | `normalizeHeic(pngFile)` returns original file unchanged | Unit (TS) | Vitest if added | No — needs creating |
| HEIC normalizer converts | `normalizeHeic(heicFile)` returns PNG File object | Integration (TS) | Needs real .heic fixture | No — needs creating |
| Rust pipeline accepts RGBA from HEIC source | Decoded RGBA bytes from JS pass through `convert_image` correctly | Integration (WASM) | `wasm-pack test` | No — needs creating |
| `formats.rs` — HEIC stays unsupported | `ImageFormat::from_name("heic")` returns error | Unit (Rust) | `cargo test` | No — needs creating |

### Gaps (files to create before implementation)

- `web/src/lib/heic.ts` — the JS-side HEIC detection and normalizer module
- `web/src/lib/__tests__/heic.test.ts` — unit tests for magic byte detection and pass-through behavior
- `web/tests/heic-integration.test.ts` — integration test with a real `.heic` fixture file
- `web/fixtures/sample.heic` — a minimal valid HEIC file for integration testing (generate with
  `ffmpeg -i any_image.png -c:v libx265 sample.heic` or obtain a royalty-free sample)
- `crates/image-converter/src/tests/heic_boundary.rs` — test that RGBA bytes from a HEIC-decoded
  source round-trip through `convert_image` correctly

Note: The existing Rust test infrastructure (unit tests in `formats.rs`, `convert.rs`) does not
need modification since HEIC is handled entirely on the JS side.

---

## Open Questions

1. **Does `heic-to` v1.4.x support Safari 17+ native decode optimization automatically?**
   - What we know: The library wraps libheif WASM. Safari native decode via `createImageBitmap` is
     separate browser behavior.
   - What's unclear: Whether `heic-to` checks for native capability and skips WASM loading.
   - Recommendation: Test manually on Safari 17+ before shipping. If the library always loads WASM,
     add explicit `createImageBitmap` detection above it.

2. **Exact uncompressed WASM binary size for `heic-to` v1.4.x**
   - What we know: `heic2any` (similar vintage) weighed 2.7 MB. `heic-to` is newer/leaner but no
     published size found.
   - What's unclear: Whether Vite's bundler can tree-shake or compress this significantly.
   - Recommendation: Run `npm run build` with `heic-to` installed and check `dist/` directory sizes
     before committing to the approach.

3. **CSP (Content Security Policy) implications**
   - What we know: `heic-to` has a `/csp` variant for CSP-strict environments.
   - What's unclear: Whether the current Astro/Vite setup has any CSP restrictions that would
     block WASM blob loading.
   - Recommendation: Check `web/public/_headers` or `astro.config.mjs` for CSP headers before
     integration.

---

## Sources

### Primary (HIGH confidence)

- `https://github.com/image-rs/image/issues/1375` — Confirmed: no HEIC in `image` crate, closed
  as not planned, root cause is HEVC patent situation
- `https://github.com/Cykooz/libheif-rs` — Confirmed: requires `libheif-dev` system library,
  no WASM support documented, last release Feb 2026
- `https://caniuse.com/heif` — Confirmed: Safari 17+ only, ~14.31% global usage
- `https://github.com/hoppergee/heic-to` — Confirmed: MIT license, actively maintained (Feb 2026),
  297 stars, 220 dependents, decode-only
- `https://github.com/strukturag/libheif` — Confirmed: LGPL license for library, MIT for samples;
  libde265 for decode, x265/kvazaar for encode; WASM compilation via Emscripten supported
- `https://github.com/kleisauke/wasm-vips/issues/3` — Confirmed: HEIC excluded from wasm-vips due
  to patent-encumbered HEVC logic; same rationale used by Sharp and NetVips

### Secondary (MEDIUM confidence)

- `https://dev.to/_85dbad023e63293c4c6db/how-we-built-a-browser-based-image-converter-with-webassembly-encoders-3i39`
  — Production case study: Safari 17.6+ native `createImageBitmap` is 17–39x faster; libheif-js
  WASM fallback is 2–3x faster than heic2any
- `https://upsidelab.io/blog/handling-heic-on-the-web` — heic2any weighs 2.7 MB; recommends
  frontend conversion for preview only, backend for actual storage
- `https://github.com/hpp2334/elheif` — elheif provides both HEIC encode and decode via WASM;
  uses kvazaar (LGPL) for encoding, libheif + libde265 via Emscripten

### Tertiary (LOW confidence — needs validation)

- Binary size for `heic-to` v1.4.2 WASM: estimated 2–4 MB based on analogous packages; not
  directly measured. Flag for validation.
- Safari 17+ `createImageBitmap` compatibility with `heic-to`: reported in production case study
  but not tested in this codebase.

---

## Metadata

**Confidence breakdown:**

- `image` crate has no HEIC support: HIGH — confirmed by closed GitHub issue with maintainer statements
- `libheif-rs` not WASM-compatible: HIGH — confirmed by library documentation and system requirements
- Hybrid JS+Rust architecture: HIGH — confirmed by production case study and wasm-vips maintainer explanation
- Browser support numbers: HIGH — caniuse.com data
- `heic-to` as recommended library: MEDIUM — library health confirmed, but exact bundle size not measured
- HEIC encoding via WASM: MEDIUM — technically possible (elheif exists), license/size tradeoffs documented
- Patent exposure risk: MEDIUM — well-documented community concern, not legal advice

**Research date:** 2026-03-05
