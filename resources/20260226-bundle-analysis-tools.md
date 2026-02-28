# Bundle Analysis Tools for Rust + WASM + TypeScript Projects

A practical reference for measuring bundle sizes accurately across the different layers of this project's stack: WASM binary, JavaScript, and network transfer. Each layer has different tools suited to it.

## Why It Matters for This Project

The app has three distinct size concerns:
- **WASM binary** (~1.5–2 MB uncompressed) — the largest asset, driven by `image` crate codecs
- **JavaScript bundle** (~80–120 KB uncompressed) — app code + PostHog SDK
- **Network transfer** — what users actually download (gzip/brotli compressed)

Adding features from the roadmap (especially new codecs, `resvg`, processing operations) can significantly increase WASM size. Without profiling, you're guessing which crates are responsible for growth. These tools give you accurate, actionable data before and after each change.

---

## Layer 1 — WASM Binary

### `twiggy` — best tool for WASM size profiling

Profiles which Rust functions and crates contribute the most bytes to the compiled `.wasm` file. Shows call-graph dominance — i.e. "removing this function would save X bytes."

```bash
cargo install twiggy

# After wasm-pack build:
twiggy top crates/image-converter/pkg/image_converter_bg.wasm

# Full call-graph contribution per function:
twiggy dominators crates/image-converter/pkg/image_converter_bg.wasm
```

Sample output from `twiggy top`:
```
 Shallow Bytes │ Shallow % │ Item
───────────────┼───────────┼──────────────────────────────────────────────
        823442 │    41.02% │ custom section '.debug_info'
         92178 │     4.59% │ image::codecs::jpeg::decoder::JpegDecoder
         61234 │     3.05% │ image::codecs::png::PngDecoder
         ...
```

### `cargo bloat` — native binary size by crate

Faster feedback loop than building to WASM. Native sizes don't map 1:1 to WASM but crate-level proportions are informative.

```bash
cargo install cargo-bloat

cargo bloat --manifest-path crates/image-converter/Cargo.toml --release --crates
```

### Raw file size + gzip/brotli estimate

The simplest and most honest measure — what the `.wasm` file actually weighs over the wire.

```bash
wasm-pack build crates/image-converter --target web --release

# Uncompressed size
wc -c crates/image-converter/pkg/image_converter_bg.wasm

# Gzip estimate (what most CDNs serve by default)
gzip -c crates/image-converter/pkg/image_converter_bg.wasm | wc -c

# Brotli estimate (Cloudflare, Netlify, and Vercel use this — smaller than gzip)
brotli -c crates/image-converter/pkg/image_converter_bg.wasm | wc -c
```

> Brotli typically compresses WASM ~5–15% smaller than gzip. Use brotli for final size reporting if the deployment platform supports it (Netlify/Vercel/Cloudflare all do).

---

## Layer 2 — JavaScript Bundle

### Parcel `--detailed-report`

Built into Parcel 2 — shows per-file sizes in the terminal with no extra setup.

```bash
cd web && npx parcel build src/index.html --detailed-report 10
```

The `10` argument shows the top 10 largest files. Increase it to see more.

### `source-map-explorer` — interactive treemap

Visualises which modules own what fraction of the JS bundle as an interactive treemap in the browser. Requires source maps to be enabled in the Parcel build.

```bash
npm install -g source-map-explorer

# Build with source maps enabled
cd web && npx parcel build src/index.html --source-maps

# Open the treemap
source-map-explorer dist/main.*.js
```

Useful for seeing exactly how much PostHog contributes vs. app code vs. any new npm dependencies.

### `bundlephobia` — evaluate npm packages before installing

Check the gzipped size of any npm dependency before adding it to `package.json`. Prevents surprise size regressions.

```bash
# CLI (no install needed)
npx bundlephobia fflate
npx bundlephobia preact
npx bundlephobia react react-dom
```

Or use the website: **bundlephobia.com**

Key packages and their costs (for reference):
| Package | Minified + Gzipped |
|---------|-------------------|
| `preact` | ~4 KB |
| `react` + `react-dom` | ~130 KB |
| `fflate` | ~10 KB |
| `workbox-window` | ~8 KB |
| `posthog-js` | ~30 KB |

---

## Layer 3 — Network / Real Transfer Size

### Chrome DevTools Network panel

The ground truth. Shows actual transfer sizes after compression, including WASM, JS, and CSS as separate entries. Steps:

1. Open DevTools → Network tab
2. Check "Disable cache"
3. Hard reload (`Cmd+Shift+R`)
4. Filter by `Wasm`, `JS`, `CSS` using the type filter buttons
5. Check the "Transferred" column (gzip/brotli compressed size) vs "Size" (uncompressed)

### Lighthouse

Reports total transfer size, unused JavaScript, and Core Web Vitals. Run against the local production build.

```bash
cd web && npx parcel build src/index.html
# Serve dist/ on a local HTTP server, then:
npx lighthouse http://localhost:1234 --view
```

Or use the Lighthouse tab inside Chrome DevTools.

---

## Recommended Workflow for This Project

Run this before and after implementing any roadmap feature that adds Rust dependencies or new codecs:

```bash
# Step 1 — Record baseline
wasm-pack build crates/image-converter --target web --release

WASM_SIZE=$(wc -c < crates/image-converter/pkg/image_converter_bg.wasm)
WASM_GZ=$(gzip -c crates/image-converter/pkg/image_converter_bg.wasm | wc -c)
echo "WASM: ${WASM_SIZE} bytes uncompressed, ${WASM_GZ} bytes gzipped"

# Step 2 — Implement the feature (add Cargo features, write code, etc.)

# Step 3 — Rebuild and compare
wasm-pack build crates/image-converter --target web --release

NEW_WASM_SIZE=$(wc -c < crates/image-converter/pkg/image_converter_bg.wasm)
NEW_WASM_GZ=$(gzip -c crates/image-converter/pkg/image_converter_bg.wasm | wc -c)
echo "WASM: ${NEW_WASM_SIZE} bytes uncompressed, ${NEW_WASM_GZ} bytes gzipped"
echo "Delta: $((NEW_WASM_SIZE - WASM_SIZE)) bytes uncompressed, $((NEW_WASM_GZ - WASM_GZ)) bytes gzipped"

# Step 4 — Profile what grew
twiggy top crates/image-converter/pkg/image_converter_bg.wasm | head -30
```

For JavaScript changes, swap in `source-map-explorer` to see which module is responsible for any growth.

---

## Gotchas and Important Details

- **`wasm-opt` is disabled** in this project (`wasm-opt = false` in `Cargo.toml` metadata) because the bundled version in `wasm-pack` doesn't support bulk memory operations. This means the WASM binary is **not optimised** — enabling `wasm-opt` via a separately installed binary (not the bundled one) could reduce WASM size by 20–35%.
- **Debug info inflates size**: Release builds strip debug info by default (`strip = true` in `Cargo.toml`). If `twiggy` shows `.debug_info` as the top entry, the build is including debug sections — check the `[profile.release]` config.
- **Gzip vs Brotli**: Report both if possible. Brotli is consistently smaller, especially for repetitive WASM bytecode. Netlify and Vercel serve Brotli automatically.
- **`twiggy` works on the `.wasm` file directly** — not the JS glue file (`image_converter.js`) generated by `wasm-pack`. The glue file is small (~5–10 KB uncompressed) and not worth profiling separately.
- **Tree-shaking in Rust**: Rust's dead-code elimination removes unused functions at link time. This means adding a `use` of an `imageops` function that was previously unused will increase binary size, but adding a second `use` of the same function will not. `twiggy` reveals which functions are already compiled in vs. newly added.

## References

- [twiggy GitHub](https://github.com/rustwasm/twiggy) — official repo, maintained by the Rust WASM working group
- [cargo-bloat GitHub](https://github.com/RazrFalcon/cargo-bloat) — per-crate and per-function size reporting for native Rust
- [source-map-explorer npm](https://www.npmjs.com/package/source-map-explorer) — JS bundle treemap
- [bundlephobia.com](https://bundlephobia.com) — npm package size lookup
- [Parcel `--detailed-report` docs](https://parceljs.org/features/cli/#--detailed-report-%5Bcount%5D) — built-in bundle reporter
- [ROADMAP.md](../ROADMAP.md) — bundle size delta estimates per feature, baseline table, and watch list
