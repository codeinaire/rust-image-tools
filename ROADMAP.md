# Rust + WASM Image Converter — Feature Roadmap

Features are ordered by implementation difficulty, easiest first. Each entry includes a difficulty rating, pros/cons, architectural considerations, and a broad todo list.

---

## Difficulty Scale

| Rating | Meaning                                                     |
| ------ | ----------------------------------------------------------- |
| 1/5    | Trivial — a few hours, minimal risk                         |
| 2/5    | Easy — a focused day or two                                 |
| 3/5    | Moderate — multi-day, some coordination between Rust and TS |
| 4/5    | Hard — significant effort, architectural decisions required |
| 5/5    | Very Hard — major undertaking, weeks of work                |

---

## Current Bundle Baseline

Estimated sizes for the existing production build (5 formats: PNG, JPEG, WebP, GIF, BMP).

| Asset                      | Uncompressed    | Gzipped         | Notes                                            |
| -------------------------- | --------------- | --------------- | ------------------------------------------------ |
| WASM binary                | ~1.5–2 MB       | ~550–750 KB     | `image` crate with 5 codecs; `wasm-opt` disabled |
| JavaScript (main + worker) | ~80–120 KB      | ~25–40 KB       | App code + PostHog SDK (~30 KB gzipped)          |
| CSS (Tailwind purged)      | ~15–25 KB       | ~5–8 KB         | Only used utility classes                        |
| HTML (`index.html`)        | ~15–20 KB       | ~5–7 KB         | Static content + JSON-LD structured data         |
| **Total**                  | **~1.6–2.2 MB** | **~585–805 KB** | Over-the-wire first load                         |

> All delta estimates below are **gzipped** (over-the-wire cost) unless stated otherwise. Uncompressed sizes are noted separately where relevant.

---

## Table of Contents

1. [Dark Mode](#1-dark-mode) — 1/5
2. [Paste from Clipboard](#2-paste-from-clipboard) — 1.5/5
3. [JPEG Quality Slider + Format Quality Controls](#3-jpeg-quality-slider--format-quality-controls) — 2/5
4. [Tier 2 Format Support — TIFF, ICO, TGA, QOI](#4-tier-2-format-support--tiff-ico-tga-qoi) — 2/5
5. [Simple Image Transforms — Flip, Rotate, Grayscale, Invert, Dither](#5-simple-image-transforms--flip-rotate-grayscale-invert-dither) — 2/5
6. [Format-Specific Landing Pages (SEO)](#6-format-specific-landing-pages-seo) — 2.5/5
7. [SVG Rasterization](#7-svg-rasterization) — 2.5/5
8. [Image Metadata + EXIF Display](#8-image-metadata--exif-display) — 2.5/5
9. [Compression Benchmark — Format Size Comparison](#9-compression-benchmark--format-size-comparison) — 2.5/5
10. [Parameterized Image Processing — Resize, Crop, Blur, Brighten, Contrast, Hue, Unsharpen](#10-parameterized-image-processing--resize-crop-blur-brighten-contrast-hue-unsharpen) — 3/5
11. [Side-by-Side Before/After Comparison](#11-side-by-side-beforeafter-comparison) — 3/5
12. [Color Palette Extraction](#12-color-palette-extraction) — 3/5
13. [PWA Support — Offline Usage](#13-pwa-support--offline-usage) — 3/5
14. [Image Watermarking](#14-image-watermarking) — 3.5/5
15. [Real Progress Reporting from Rust](#15-real-progress-reporting-from-rust) — 3.5/5
16. [React Frontend Migration](#16-react-frontend-migration) — 4/5
17. [Batch Processing](#17-batch-processing) — 4/5
18. [Raise File Size and Memory Limits](#18-raise-file-size-and-memory-limits) — 4.5/5
19. [Worker Pool for Parallel Batch Conversion](#19-worker-pool-for-parallel-batch-conversion) — 4.5/5

---

## 1. Dark Mode

**Difficulty: 1/5**

### Overview

Add a light/dark theme toggle with persistence via `localStorage`. Tailwind CSS v4 has native dark mode support via the `dark:` variant and media query or class strategy.

### Pros

- High user expectation — dark mode is standard on any modern tool
- Near-zero risk: purely CSS/TS, no Rust changes
- Tailwind v4 makes it trivial: add `dark:` prefix variants to existing classes
- Improves UX for users working in low-light environments

### Cons

- Requires auditing every color in `styles.css` and `index.html` for dark variants
- Need to decide: `prefers-color-scheme` only, or a manual toggle (manual toggle is better UX)
- Minor testing burden across both themes

### Architectural Considerations

- Use Tailwind's class-based dark mode strategy (`darkMode: 'class'` in config — Tailwind v4 uses `:dark` selector on `<html>`) rather than media-query-only, so user preference persists independently of system setting
- Store preference in `localStorage` under a key like `color-scheme`
- Toggle adds/removes `.dark` on `<html>` element
- No Worker or Rust changes needed

### Bundle Size Impact

| Asset       | Delta (uncompressed) | Delta (gzipped) | Notes                                              |
| ----------- | -------------------- | --------------- | -------------------------------------------------- |
| WASM binary | 0                    | 0               | No Rust changes                                    |
| JavaScript  | +~1–2 KB             | +~0.5–1 KB      | Toggle logic, `localStorage` read/write            |
| CSS         | +~8–15 KB            | +~3–6 KB        | `dark:` variants for all existing Tailwind classes |
| **Total**   | **+~9–17 KB**        | **+~3.5–7 KB**  | Smallest footprint of any feature in this roadmap  |

> CSS is the main contributor. Tailwind v4 purges unused classes, so cost is proportional to how many `dark:` variants you add. Using CSS custom properties (`--color-bg` etc.) instead of per-element `dark:` variants can halve this cost.

### Broad Todo List

- [ ] Configure Tailwind v4 dark mode strategy (class-based)
- [ ] Add dark mode color tokens for background, text, borders, and interactive elements
- [ ] Audit all `index.html` Tailwind classes and add `dark:` variants
- [ ] Add a theme toggle button (sun/moon icon) in the header
- [ ] Implement toggle logic in `ui.ts` — read from `localStorage` on load, write on toggle
- [ ] Apply OS preference on first visit (`window.matchMedia('(prefers-color-scheme: dark)')`)
- [ ] Test both themes visually across all UI states (idle, uploading, converting, error, preview)

### Additional Notes

- The progress bar, drop zone, and preview card are the visually complex elements to handle
- SVG icons for sun/moon can be inline in HTML to avoid extra network requests
- Consider using CSS custom properties (`--color-bg`, `--color-text`) to centralize theme values if many variants exist

---

## 2. Paste from Clipboard

**Difficulty: 1.5/5**

### Overview

Allow users to paste an image directly from the clipboard using `Ctrl+V` / `Cmd+V` (or a dedicated "Paste" button). Most operating systems copy screenshots and UI elements to the clipboard as PNG or JPEG image data.

### Pros

- Huge workflow improvement — pasting a screenshot is faster than saving + selecting a file
- Common user expectation for image tools
- Pure frontend change — no Rust or Worker changes
- Clipboard API is well-supported in modern browsers

### Cons

- Requires user permission prompt (the Clipboard API gate) in some browsers
- Clipboard data is always returned as a `Blob`; need to handle MIME type detection (the `image` crate's format detection from bytes already handles this)
- Some browsers (especially Firefox) have inconsistent Clipboard API behavior
- Cannot paste a file path — only actual image data

### Architectural Considerations

- Hook into `document.addEventListener('paste', ...)` to intercept clipboard paste events globally
- Also add a "Paste image" button that calls `navigator.clipboard.read()` for explicit trigger
- Convert clipboard `Blob` → `ArrayBuffer` → `Uint8Array` and feed into the existing file processing pipeline (`handleFile()` in `ui.ts`) — no special casing needed
- The existing format detection (`detect_format`) will correctly identify PNG/JPEG/WebP data from clipboard bytes

### Bundle Size Impact

| Asset       | Delta (uncompressed) | Delta (gzipped) | Notes                                             |
| ----------- | -------------------- | --------------- | ------------------------------------------------- |
| WASM binary | 0                    | 0               | No Rust changes                                   |
| JavaScript  | +~1–2 KB             | +~0.5–1 KB      | Paste event handler + clipboard API glue          |
| CSS         | 0                    | 0               | No new UI elements beyond existing button styling |
| **Total**   | **+~1–2 KB**         | **+~0.5–1 KB**  | Negligible — the cheapest feature in this roadmap |

> The `paste` event listener and `Blob → Uint8Array` conversion are a handful of lines that compress to near nothing. No new dependencies.

### Broad Todo List

- [ ] Add global `paste` event listener in `ui.ts` on `document`
- [ ] Extract `ImageItem` from `ClipboardEvent.clipboardData.items` filtering for `image/*`
- [ ] Convert clipboard `Blob` to `Uint8Array` and pass to existing file handling pipeline
- [ ] Add optional "Paste image" button in the UI (calls `navigator.clipboard.read()`)
- [ ] Handle permission denial gracefully with a user-friendly error
- [ ] Handle multi-item clipboard (take the first image item)
- [ ] Track `input_method: "clipboard_paste"` in existing PostHog `image_selected` analytics event
- [ ] Test on Chrome, Firefox, Safari (paste event behavior differs slightly)

### Additional Notes

- The `paste` event's `clipboardData` does not require the `clipboard-read` permission — it fires naturally on paste and is always granted
- `navigator.clipboard.read()` (for the explicit button) does require the `clipboard-read` permission in Chromium browsers
- Generate a synthetic filename like `pasted-image-{timestamp}.png` for the download filename

---

## 3. JPEG Quality Slider + Format Quality Controls

**Difficulty: 2/5**

### Overview

Expose output quality as a user-configurable parameter for lossy formats. JPEG is the primary target (quality 1–100), but the design should accommodate future lossy formats like WebP lossy or AVIF.

### Pros

- High user value — power users always want quality control
- Enables the "find optimal file size" use case
- Relatively small Rust change: the `image` crate's JPEG encoder already accepts a quality parameter
- The UI is a familiar HTML range slider

### Cons

- Must update the WASM API to accept an optional quality parameter, changing the function signature
- Need to update the Worker message protocol (`worker-types.ts`) to carry quality
- Quality only applies to JPEG (and future lossy formats); the UI must show/hide the slider contextually
- No quality setting for lossless formats (PNG, BMP, GIF) — this distinction needs clear UI communication

### Architectural Considerations

- Extend `convert_image()` WASM export to accept an optional `quality: Option<u8>` (or a separate `convert_image_with_options()` function to avoid breaking existing calls)
- In Rust: use `image::codecs::jpeg::JpegEncoder::new_with_quality()` instead of the default encoder
- Worker message `ConvertImageRequest` gains an optional `quality?: number` field
- The slider should only appear when the selected target format is JPEG (or another lossy format)
- Display a live "estimated file size" readout as the slider moves — this is an approximation since actual size depends on image content

### Bundle Size Impact

| Asset       | Delta (uncompressed) | Delta (gzipped) | Notes                                                                      |
| ----------- | -------------------- | --------------- | -------------------------------------------------------------------------- |
| WASM binary | +~3–8 KB             | +~1–3 KB        | `JpegEncoder::new_with_quality()` code path; `PngEncoder` quality optional |
| JavaScript  | +~1–2 KB             | +~0.5–1 KB      | Slider UI, Worker message update, conditional display logic                |
| CSS         | +~1–2 KB             | +~0.5 KB        | Range input styling                                                        |
| **Total**   | **+~5–12 KB**        | **+~2–5 KB**    | Very low cost for high user value                                          |

> The WASM delta is minimal because `JpegEncoder::new_with_quality()` is already in the `image` crate — it's just a different constructor call. No new monomorphizations or codec logic needed.

### Broad Todo List

**Rust (WASM):**

- [ ] Add `quality: Option<u8>` parameter to `convert_image()` (or add `convert_image_with_options()`)
- [ ] Use `JpegEncoder::new_with_quality()` when quality is specified, default to 80 when not
- [ ] Return an error if quality is outside 1–100
- [ ] Add unit tests for quality boundaries (1, 50, 80, 100) and invalid values

**Frontend:**

- [ ] Add a quality slider (`<input type="range" min="1" max="100" value="80">`) to the UI
- [ ] Show the slider only when the target format is JPEG (or other lossy formats as added)
- [ ] Display current quality value next to the slider (e.g., "Quality: 80")
- [ ] Update `worker-types.ts` `ConvertImageRequest` to include `quality?: number`
- [ ] Update `worker.ts` to pass quality to `convert_image()`
- [ ] Update `ui.ts` to read slider value and include it in the Worker message
- [ ] Update PostHog `conversion_started` event to include `quality` property
- [ ] Add "Quality" label with a tooltip explaining what quality affects

### Additional Notes

- JPEG quality 80 is a sensible default (good balance of size vs. visual quality)
- Consider also exposing PNG compression level (0–9) — lower = faster + larger file, higher = slower + smaller file. The `image` crate supports this via `PngEncoder::new_with_quality()`
- A future "target file size" mode would use binary search over quality values to find the setting that produces a file near the target size — very useful for social media uploads with size caps

---

## 4. Tier 2 Format Support — TIFF, ICO, TGA, QOI

**Difficulty: 2/5**

### Overview

Add the four Tier 2 formats from PLANNING.md. All are pure-Rust codecs in the `image` crate — no native dependencies required, making them straightforward WASM additions.

| Format | Decode | Encode | Notes                                    |
| ------ | ------ | ------ | ---------------------------------------- |
| TIFF   | Yes    | Yes    | Used in professional/print workflows     |
| ICO    | Yes    | Yes    | Windows icon format, multi-resolution    |
| TGA    | Yes    | Yes    | Legacy game/graphics format              |
| QOI    | Yes    | Yes    | Modern fast lossless format, simple spec |

### Pros

- Near-zero Rust complexity — just add cargo features and update `formats.rs`
- Expands the target keyword surface for SEO (`tiff to png`, `ico converter`, etc.)
- QOI is an interesting modern format that techie users will appreciate
- TIFF is important for professional photo workflows (some cameras output TIFF)
- ICO is genuinely useful for favicon generation workflows

### Cons

- ICO files can contain multiple embedded images at different sizes — the `image` crate reads the first/largest; multi-resolution write support is limited
- TIFF can have many variants (BigTIFF, TIFF with JPEG compression, etc.) — some may error
- TGA has limited use today — mostly legacy
- Each new format increases the WASM binary size slightly
- The UI format selector dropdown grows — may need visual grouping or a search/filter

### Architectural Considerations

- Add `tiff`, `ico`, `tga`, `qoi` features to `Cargo.toml` for the `image` crate
- Extend `ImageFormat` enum in `formats.rs` with new variants
- `to_image_format()` mapping is straightforward — all four are first-class in `image::ImageFormat`
- `detect_from_bytes()` will work automatically via `image::guess_format()` for TIFF, TGA, QOI (they have distinct magic bytes); ICO's magic is `[0x00, 0x00, 0x01, 0x00]`
- Frontend: add new options to the target format `<select>` dropdown
- Consider grouping formats visually: "Common" (PNG, JPEG, WebP, GIF, BMP) and "Other" (TIFF, ICO, TGA, QOI)

### Bundle Size Impact

| Asset                     | Delta (uncompressed) | Delta (gzipped) | Notes                                                    |
| ------------------------- | -------------------- | --------------- | -------------------------------------------------------- |
| WASM binary — TIFF        | +~180–260 KB         | +~60–90 KB      | `tiff` crate is the heaviest; handles many TIFF variants |
| WASM binary — ICO         | +~50–80 KB           | +~18–28 KB      | Container format wrapping PNG/BMP internally             |
| WASM binary — TGA         | +~30–50 KB           | +~10–18 KB      | Simple run-length encoded format                         |
| WASM binary — QOI         | +~15–25 KB           | +~5–9 KB        | Extremely simple spec — smallest codec of the four       |
| **WASM total (all four)** | **+~275–415 KB**     | **+~93–145 KB** | Adds ~15–25% to current WASM binary                      |
| JavaScript                | +~1–2 KB             | +~0.5–1 KB      | New `<option>` elements, format name mappings            |
| CSS                       | 0                    | 0               | No new styles needed                                     |
| **Grand total**           | **+~276–417 KB**     | **+~93–146 KB** | Dominated entirely by WASM codec additions               |

> **Add formats incrementally** rather than all at once — add QOI first (smallest, most interesting), then ICO (favicon workflow), then TIFF. Skip TGA unless there's user demand; it adds ~15 KB gzipped for a rarely-used legacy format.

### Broad Todo List

**Rust (WASM):**

- [ ] Add `tiff`, `ico`, `tga`, `qoi` features to `Cargo.toml`
- [ ] Add `Tiff`, `Ico`, `Tga`, `Qoi` variants to `ImageFormat` enum
- [ ] Extend `from_name()` to handle `"tiff"/"tif"`, `"ico"`, `"tga"`, `"qoi"` strings
- [ ] Add `to_image_format()` mappings for all four
- [ ] Update `detect_from_bytes()` to recognize new format magic bytes (where needed)
- [ ] Add conversion matrix tests for all new format pairs
- [ ] Verify WASM binary size increase is acceptable

**Frontend:**

- [ ] Add new options to target format dropdown in `index.html`
- [ ] Update format display names and icon/badge mapping in `ui.ts` if applicable
- [ ] Update SEO content in `index.html` to mention new formats (meta description, FAQ, supported formats section)
- [ ] Update `sitemap.xml` to include new format pairs if format landing pages are implemented
- [ ] Test download MIME types and file extensions for each new format

### Additional Notes

- QOI is worth highlighting as a "fast lossless" option — it decodes/encodes 3–10x faster than PNG for similar compression ratios. This is a differentiator
- ICO is useful for a "convert image to favicon" workflow — consider adding a dedicated "Favicon Generator" mode that creates a proper multi-resolution ICO from any input
- TIFF files are often very large (uncompressed RAW exports from cameras) — test against the 200 MB file size limit and add appropriate messaging

---

## 5. Simple Image Transforms — Flip, Rotate, Grayscale, Invert, Dither

**Difficulty: 2/5**

### Overview

Expose a set of one-click, zero-parameter image transforms from the `image` crate's `imageops` module. These can be applied before conversion, transforming the output rather than the input file directly.

| Operation                | `imageops` function | Parameters |
| ------------------------ | ------------------- | ---------- |
| Flip horizontal          | `flip_horizontal()` | None       |
| Flip vertical            | `flip_vertical()`   | None       |
| Rotate 90° CW            | `rotate90()`        | None       |
| Rotate 180°              | `rotate180()`       | None       |
| Rotate 270° CW / 90° CCW | `rotate270()`       | None       |
| Grayscale                | `grayscale()`       | None       |
| Invert colors            | `invert()`          | None       |
| Dither (quantize)        | `dither()`          | Color map  |

### Pros

- Genuinely useful: fix phone camera auto-rotation, mirror screenshots, make grayscale copies
- No UI complexity — each is a simple toggle button or radio
- Clean Rust implementation — all functions are zero-parameter, one-liner wrappers
- Grayscale and invert are very commonly needed operations

### Cons

- Adds UI surface area — need to decide on the interaction model (toolbar of buttons? checkboxes? applied in sequence?)
- Transforms are applied before conversion, so the preview must update after each toggle — requires a re-conversion on every toggle action, which may feel slow for large images
- Dithering is only meaningful when converting to palette-limited formats (GIF, 8-bit PNG) — context-sensitive display needed
- Need to think about transform ordering (does rotate then flip = flip then rotate?)

### Architectural Considerations

- Extend the Rust `convert_image()` function to accept an optional `TransformOptions` struct, or add a separate `transform_image()` function that applies transforms to raw pixels before encoding
- A clean approach: add a `pipeline` step in `convert.rs` that applies transforms to the decoded `DynamicImage` before encoding. The `imageops` functions all accept `&mut DynamicImage` or return a new image.
- Worker message `ConvertImageRequest` gains a `transforms?: string[]` field (ordered list of transform names, e.g., `["rotate90", "grayscale"]`)
- On the frontend, transforms are a state array that updates on each button click — re-run conversion on any change
- For large images, consider debouncing re-conversion by 300ms to avoid thrashing

### Bundle Size Impact

| Asset                           | Delta (uncompressed) | Delta (gzipped) | Notes                                                      |
| ------------------------------- | -------------------- | --------------- | ---------------------------------------------------------- |
| WASM binary — flip H/V          | +~5–10 KB            | +~2–4 KB        | Simple pixel reordering                                    |
| WASM binary — rotate 90/180/270 | +~12–20 KB           | +~4–7 KB        | Rotation requires new allocation per call                  |
| WASM binary — grayscale         | +~5–10 KB            | +~2–4 KB        | Channel averaging, already partially in `image` crate      |
| WASM binary — invert            | +~3–6 KB             | +~1–2 KB        | Simple bitwise NOT per channel                             |
| WASM binary — dither            | +~20–35 KB           | +~7–12 KB       | Floyd-Steinberg or ordered dither algorithm                |
| **WASM total**                  | **+~45–81 KB**       | **+~16–29 KB**  | Many functions are already compiled in but tree-shaken out |
| JavaScript                      | +~2–3 KB             | +~1–1.5 KB      | Transform toolbar, state array, debounce logic             |
| CSS                             | +~2–4 KB             | +~1–2 KB        | Toolbar button styling                                     |
| **Grand total**                 | **+~49–88 KB**       | **+~18–32 KB**  | Reasonable cost for 8 useful operations                    |

> Rust's dead-code elimination removes unused `imageops` functions at compile time. Adding these features forces those functions to be compiled in. The actual delta depends on which functions are already present due to internal `image` crate usage (e.g., `grayscale` may already be compiled in for GIF palette operations).

### Broad Todo List

**Rust (WASM):**

- [ ] Add `apply_transforms(img: DynamicImage, transforms: &[&str]) -> Result<DynamicImage, ConvertError>` in `convert.rs`
- [ ] Implement each transform case using `imageops::*` functions
- [ ] Integrate `apply_transforms` into the `convert()` pipeline (between decode and encode)
- [ ] Export transforms as a `wasm_bindgen` function or embed in `convert_image()` via extended options
- [ ] Add unit tests for each transform (verify dimensions after rotate90, pixel values after invert, etc.)

**Frontend:**

- [ ] Design a transforms toolbar in `index.html` (icon buttons for flip H/V, rotate CW/CCW, grayscale toggle, invert toggle)
- [ ] Manage transforms state as an ordered `string[]` in `ui.ts`
- [ ] Wire each toolbar button to update state and trigger re-conversion
- [ ] Add debounce (300ms) on re-conversion when transforms change
- [ ] Show/hide dither option only when target format is GIF or indexed PNG
- [ ] Reset transforms state when a new image is loaded
- [ ] Include applied transforms in PostHog `conversion_started` event

### Additional Notes

- Rotate 90° changes image dimensions (width↔height) — the progress estimate will need the post-rotation dimensions
- Grayscale before JPEG encoding saves file size — could add a tooltip explaining this
- Dithering is important when converting color images to GIF — the existing GIF warning could mention enabling dithering for better quality
- "Invert + grayscale" is a popular combination for dark UI mockup screenshots

---

## 6. Format-Specific Landing Pages (SEO)

**Difficulty: 2.5/5**

### Overview

Create dedicated landing pages for high-value format conversion keyword pairs (e.g., `/png-to-jpeg`, `/webp-to-png`). Each page is the same tool but with format-specific title, meta tags, and pre-selected format dropdowns via URL parameters.

### Pros

- Directly targets long-tail SEO keywords with high conversion intent ("convert webp to png online")
- Competitors (CloudConvert, Convertio, Zamzar) rank for hundreds of these pages — this is how they get organic traffic
- Low marginal effort per page once the URL parameter system is in place
- No backend needed — URL params read by JavaScript on load

### Cons

- Requires careful URL routing in Vite (or a static site generator approach)
- Each page needs unique `<title>` and `<meta name="description">` — can't just be injected by JS since search engines may not execute JS for crawling
- If using a SPA approach, the static HTML must be pre-generated for each URL path (SSG)
- Maintaining N×M pages (every format pair) grows unwieldy as formats are added

### Architectural Considerations

- **Approach A (URL params, JS-only):** Read `?from=webp&to=png` from `window.location.search` and pre-select dropdowns. Fast to build, but Google may or may not fully crawl JS-rendered titles/meta tags.
- **Approach B (Static HTML per path, Vite):** Use a script to generate separate HTML files for each format pair with hardcoded titles/meta. Each file is the same template but with different meta tags. Vite builds all of them. This is the recommended approach for SEO.
- **Approach C (Netlify/Cloudflare redirects + edge functions):** Route `/png-to-jpeg` to `index.html?from=png&to=jpeg` at the CDN layer, and use an edge function to inject the correct title/description into the HTML head before serving. Complex but eliminates build-time generation.
- Start with Approach B (static HTML generation) — a simple Node script can generate the files before build.

### Bundle Size Impact

| Asset                    | Delta (uncompressed) | Delta (gzipped)  | Notes                                                                 |
| ------------------------ | -------------------- | ---------------- | --------------------------------------------------------------------- |
| WASM binary              | 0                    | 0                | No Rust changes                                                       |
| JavaScript (shared)      | +~0.5–1 KB           | +~0.3–0.5 KB     | URL param reading on load, pre-selection logic                        |
| HTML (per landing page)  | +~12–18 KB           | +~3–5 KB         | Separate HTML document per format pair, served on demand              |
| Sitemap                  | +~2–5 KB             | +~0.5–1 KB       | More entries; fetched separately                                      |
| **Initial bundle delta** | **+~0.5–1 KB**       | **+~0.3–0.5 KB** | Landing pages are separate HTTP requests, not part of the main bundle |

> Landing pages do not increase the initial load. Each `/png-to-jpeg` URL is a separate HTML document fetched only when a user navigates to that URL. The WASM binary is shared across all pages and served from browser cache after the first visit. With 20 format pairs, total additional HTML is ~60–100 KB uncompressed across all pages — negligible.

### Broad Todo List

- [ ] Decide on URL scheme: `/png-to-jpeg` vs `/convert/png/to/jpeg`
- [ ] Create a template HTML file with placeholder tokens for title, description, source format, and target format
- [ ] Write a `generate-pages.js` Node script that produces one HTML file per format pair (N×M combinations)
- [ ] Add the script to the build pipeline (`"prebuild": "node scripts/generate-pages.js"`)
- [ ] Update `ui.ts` to read URL path or query params and pre-select source/target formats on load
- [ ] Add format-pair-specific FAQ content to each generated page
- [ ] Add individual `<link rel="canonical">` to each page
- [ ] Update `sitemap.xml` to list all landing page URLs
- [ ] Add `hreflang` if multi-language is planned (skip for now)
- [ ] Verify Lighthouse SEO scores for generated pages

### Additional Notes

- Start with the 10 highest-value pairs: `webp-to-png`, `png-to-jpeg`, `jpeg-to-png`, `gif-to-png`, `bmp-to-png`, `png-to-gif`, `png-to-webp`, `jpeg-to-webp`, `gif-to-jpeg`, `tiff-to-png` (after Tier 2 is implemented)
- Use Google Search Console to monitor which format pairs are getting impressions and optimize those first
- Internal linking between related pages (e.g., "Also try: PNG to JPEG →") improves crawlability and SEO

---

## 7. SVG Rasterization

**Difficulty: 2.5/5**

### Overview

Accept SVG files as input and rasterize them to a bitmap format (PNG, JPEG, etc.). SVGs cannot be encoded back to SVG — this is a one-way conversion (SVG → raster). Requires the `resvg` crate, a pure-Rust SVG renderer.

### Pros

- SVG → PNG is a genuinely useful and commonly searched operation
- `resvg` is pure Rust, WASM-compatible, and actively maintained
- High-quality rendering: supports most SVG 1.1 features
- No server required — maintains the privacy-first value proposition

### Cons

- `resvg` is a significant binary size addition (~1–3 MB increase in WASM output)
- Font rendering requires bundling font data or accepting that SVGs using system fonts will fall back
- Very complex SVG files (filters, animations, CSS) may render incorrectly or slowly
- Output resolution must be specified by the user or guessed — SVGs are scalable, so the user needs to choose a target pixel size
- SVG cannot be encoded back to SVG (no vector export), which may confuse users

### Architectural Considerations

- Add `resvg` and `tiny-skia` (its rendering backend) as dependencies; both are WASM-compatible
- Add `Svg` variant to `ImageFormat` enum, but only as a decode-only format (`EncodeUnsupported` for SVG output)
- `detect_from_bytes()` needs SVG detection: check for `<?xml` or `<svg` at the start (SVGs don't have binary magic bytes)
- Add a `rasterize_svg(input: &[u8], width: u32, height: u32) -> Result<Vec<u8>, JsError>` function that uses `resvg` to render at the specified dimensions
- Or: integrate into `convert_image()` with a default resolution (e.g., 1024px wide preserving aspect ratio)
- The frontend must show a resolution input when SVG is the source format

### Bundle Size Impact

| Asset                           | Delta (uncompressed) | Delta (gzipped)   | Notes                                                   |
| ------------------------------- | -------------------- | ----------------- | ------------------------------------------------------- |
| WASM binary — `resvg`           | +~1.2–2 MB           | +~400–700 KB      | SVG tree parser (`usvg`) + renderer                     |
| WASM binary — `tiny-skia`       | +~300–600 KB         | +~100–200 KB      | 2D rendering backend (path fill, stroke, blending)      |
| WASM binary — `resvg` font data | +~100–400 KB         | +~40–120 KB       | Bundled font for SVG `<text>` elements (optional)       |
| **WASM total**                  | **+~1.6–3 MB**       | **+~540 KB–1 MB** | Roughly doubles the current WASM binary size            |
| JavaScript                      | +~1–2 KB             | +~0.5–1 KB        | SVG-specific UI (resolution inputs, format restriction) |
| CSS                             | 0                    | 0                 | No new styles                                           |
| **Grand total**                 | **+~1.6–3 MB**       | **+~540 KB–1 MB** | **Largest single WASM addition in this roadmap**        |

> SVG rasterization is the most expensive feature by bundle size, bar none. The `resvg` + `tiny-skia` dependency tree adds more bytes than the entire current WASM binary. **Mitigation strategies**: (1) lazy-load the SVG WASM module separately and only fetch it when the user uploads an SVG file; (2) skip bundled fonts and accept that SVG `<text>` with system fonts will use fallback rendering. Lazy-loading keeps the initial bundle unchanged and only incurs the cost when needed.

### Broad Todo List

**Rust (WASM):**

- [ ] Add `resvg` and `tiny-skia` to `Cargo.toml`
- [ ] Add `Svg` to `ImageFormat` enum as decode-only
- [ ] Implement `detect_svg(input: &[u8]) -> bool` using XML/SVG signature detection
- [ ] Implement SVG rasterization using `resvg::render()` → `tiny_skia::Pixmap`
- [ ] Convert `Pixmap` to `image::DynamicImage` (copy RGBA bytes) for the existing encode pipeline
- [ ] Add WASM export `rasterize_svg(input: &[u8], width: u32, height: u32) -> Result<Vec<u8>, JsError>`
- [ ] Add unit tests for SVG detection and rasterization
- [ ] Measure WASM binary size increase and optimize if needed

**Frontend:**

- [ ] Show "Output size" input fields (width × height) when source format is SVG
- [ ] Default to SVG viewBox dimensions parsed from the SVG text (or 1024×768 fallback)
- [ ] Update `worker.ts` to call `rasterize_svg()` instead of `convert_image()` for SVG input
- [ ] Update UI to clarify "SVG files can be converted to raster formats only"
- [ ] Add SVG to the supported formats section in `index.html`

### Additional Notes

- Consider letting the user lock aspect ratio when specifying output dimensions
- `resvg` does not support JavaScript in SVGs, CSS animations, or `<use>` elements referencing external URLs — document these limitations
- Binary size concern: run `wasm-opt -Os` and check final bundle size before shipping
- SVG files with embedded fonts will render with a fallback if the font is not bundled — this is acceptable for most use cases

---

## 8. Image Metadata + EXIF Display

**Difficulty: 2.5/5**

### Overview

Extract and display image metadata from uploaded files — EXIF data for JPEG/TIFF (camera model, focal length, ISO, GPS, date taken), PNG metadata chunks (description, creation time), and general file info (color space, bit depth, ICC profile presence).

### Pros

- Useful for photographers who want to verify metadata before sharing
- Can also warn when GPS location data is present (privacy feature — "this image contains GPS coordinates")
- No server required — EXIF parsing is pure data reading from file bytes
- The `kamadak-exif` crate is pure Rust and WASM-compatible

### Cons

- `kamadak-exif` adds binary size (though it's small, ~100–200 KB)
- EXIF data is present in JPEG and TIFF only; PNG, GIF, BMP, WebP have limited or no standard metadata
- Parsing and displaying metadata requires a UI panel — adds visual complexity
- EXIF can contain many fields (100+) — need to filter and show only the most useful ones
- The WASM boundary makes returning structured data from Rust to JS slightly complex (use `serde_json` or `JsValue`)

### Architectural Considerations

- Add `kamadak-exif` to `Cargo.toml` (or use `exif` crate)
- Add a new WASM export `get_metadata(input: &[u8]) -> Result<JsValue, JsError>` that returns a JSON-serializable struct
- Return a flat `HashMap<String, String>` or a typed struct serialized via `serde-wasm-bindgen`
- Display only a curated set of tags: Make, Model, DateTime, ExposureTime, FNumber, ISO, GPSLatitude, GPSLongitude, Width, Height, ColorSpace, Orientation
- Show a GPS warning prominently if GPS tags are detected
- The metadata panel appears below or alongside the image preview — collapsible by default

### Bundle Size Impact

| Asset                        | Delta (uncompressed) | Delta (gzipped) | Notes                                                 |
| ---------------------------- | -------------------- | --------------- | ----------------------------------------------------- |
| WASM binary — `kamadak-exif` | +~80–130 KB          | +~28–45 KB      | EXIF tag parser; includes IFD traversal and tag table |
| WASM binary — glue code      | +~5–10 KB            | +~2–4 KB        | `get_metadata()` export + serde serialization         |
| JavaScript                   | +~2–3 KB             | +~0.8–1.2 KB    | Metadata panel DOM, GPS warning logic                 |
| CSS                          | +~1–2 KB             | +~0.4–0.8 KB    | Collapsible panel, table styling                      |
| **Grand total**              | **+~88–145 KB**      | **+~31–51 KB**  | Modest cost; `kamadak-exif` is a focused, lean crate  |

> The Cons section noted `~100–200 KB` — that estimate was for the uncompressed binary. Gzipped (the actual over-the-wire cost) is closer to 30–50 KB. Note that `serde` + `serde-wasm-bindgen` are already in `Cargo.toml`, so serializing the metadata struct to JS adds essentially zero new dependencies.

### Broad Todo List

**Rust (WASM):**

- [ ] Add `kamadak-exif` (or `exif`) to `Cargo.toml`
- [ ] Implement `get_metadata(input: &[u8]) -> Result<JsValue, JsError>` in `lib.rs`
- [ ] Parse EXIF fields and return a `HashMap<String, String>` of formatted key-value pairs
- [ ] Detect GPS presence and return a boolean `has_gps` flag
- [ ] Return `None` gracefully for formats with no EXIF support (PNG, GIF, BMP)
- [ ] Add unit tests for EXIF parsing with real JPEG fixtures

**Frontend:**

- [ ] Call `get_metadata()` in the Worker alongside `get_dimensions()` when a file is loaded
- [ ] Design a collapsible metadata panel in `index.html`
- [ ] Display key EXIF fields in a clean table format
- [ ] Show a prominent "GPS data detected" warning with a note about privacy
- [ ] Update `analytics.ts` to include `has_exif` and `has_gps` in the `image_selected` event

### Additional Notes

- "Strip EXIF metadata" is a natural follow-on feature: re-encode the image without EXIF (JPEG → JPEG, stripping metadata) — this is a privacy tool that many users want
- EXIF orientation tag (1–8) determines if the image is stored rotated — the `image` crate already handles this via `DynamicImage::into_img()` when loading. Displaying the orientation value is useful debugging info.

---

## 9. Compression Benchmark — Format Size Comparison

**Difficulty: 2.5/5**

### Overview

After the user uploads an image, automatically convert it to all supported formats in the background and show a size comparison table. Lets users find the smallest file format for their specific image without manual trial-and-error.

### Pros

- Genuinely unique feature — no major competitor does this in-browser
- High utility: "which format gives me the smallest file?" is a common question
- Leverages the existing conversion pipeline with no Rust changes
- Makes the "privacy-first" angle even stronger (all done locally, instantly)
- Great for SEO: unique, useful tool that gets links and shares

### Cons

- Running N conversions in sequence after upload increases time-to-interactive
- For large images (e.g., 12 MP), running 5+ conversions could take 2–5 seconds total
- Showing a table of results before the user requests a specific conversion changes the UX flow
- "Best" format depends on use case (JPEG is smaller for photos; PNG is better for screenshots with text)

### Architectural Considerations

- Run all benchmark conversions in the Web Worker sequentially, using the existing `convert_image()` calls
- Return results incrementally: as each format completes, post a `BenchmarkProgress` message to the main thread so the table populates live
- Add a new Worker message type `BenchmarkImages` that accepts input bytes and target format list, returns results one-by-one via `BenchmarkResult` messages
- The main thread renders a table with format name, file size, size change %, and a "Convert to this" button
- Use JPEG quality 80 as the default for JPEG benchmarks; PNG default compression

### Bundle Size Impact

| Asset           | Delta (uncompressed) | Delta (gzipped)  | Notes                                                                    |
| --------------- | -------------------- | ---------------- | ------------------------------------------------------------------------ |
| WASM binary     | 0                    | 0                | Uses existing `convert_image()` — no new Rust code                       |
| JavaScript      | +~2–4 KB             | +~0.8–1.5 KB     | Benchmark orchestration loop, new Worker message types, results table UI |
| CSS             | +~1–2 KB             | +~0.4–0.8 KB     | Results table, loading skeleton, highlight styling                       |
| **Grand total** | **+~3–6 KB**         | **+~1.2–2.3 KB** | Near-zero bundle cost — feature is pure orchestration logic              |

> This is the best cost-to-value ratio of any feature in this roadmap. Zero new dependencies, zero WASM cost. The feature is entirely implemented by calling existing code in a loop and rendering results.

### Broad Todo List

**Worker:**

- [ ] Add `BenchmarkImages` request type to `worker-types.ts`
- [ ] Add `BenchmarkResult` and `BenchmarkComplete` response types
- [ ] Implement benchmark loop in `worker.ts`: iterate formats, convert, post `BenchmarkResult` per format
- [ ] Allow early termination if a new file is loaded while benchmarking

**Frontend:**

- [ ] Add a results table to `index.html` (hidden initially, shown after benchmark completes)
- [ ] Handle incremental `BenchmarkResult` messages — populate table rows as they arrive
- [ ] Add a "Convert to this" button per row that pre-selects the format and triggers download
- [ ] Highlight the smallest output format in the table
- [ ] Add a loading skeleton for rows that haven't completed yet
- [ ] Track benchmark completion in PostHog (`benchmark_viewed` event with format rankings)

### Additional Notes

- The benchmark should be opt-in (a "Compare all formats" button) rather than running automatically on every upload to avoid unnecessary computation for simple use cases
- Show a progress indicator (e.g., "Comparing 4/6 formats...") so users know it's working
- Only benchmark output formats (not the input format as output of itself), and skip SVG
- Consider using `Promise.allSettled` in the Worker with sequential calls (not parallel — WASM is single-threaded)

---

## 10. Parameterized Image Processing — Resize, Crop, Blur, Brighten, Contrast, Hue, Unsharpen

**Difficulty: 3/5**

### Overview

Implement the full set of parameterized image processing operations from the `image` crate's `imageops` module. Unlike the simple transforms in Feature 5, these require user-supplied parameters and a more complex UI.

| Operation       | `imageops` function | Parameters                                     |
| --------------- | ------------------- | ---------------------------------------------- |
| Resize          | `resize()`          | Width, height, filter type                     |
| Thumbnail       | `thumbnail()`       | Max width, max height (preserves aspect ratio) |
| Crop            | `crop_imm()`        | x, y, width, height                            |
| Blur (Gaussian) | `blur()`            | Sigma (float)                                  |
| Fast blur       | `fast_blur()`       | Sigma (float)                                  |
| Unsharpen mask  | `unsharpen()`       | Sigma, threshold                               |
| Brighten        | `brighten()`        | Value (-255 to 255)                            |
| Contrast        | `contrast()`        | Value (float, -100.0 to 100.0)                 |
| Hue rotate      | `huerotate()`       | Degrees (0–360)                                |
| Tile            | `tile()`            | Count or fill mode                             |

### Pros

- Transforms this from a "format converter" to a lightweight "image editor" — much higher user retention and utility
- All operations are available in the `image` crate with no additional dependencies
- Resize is especially high-value: "resize image online" is a top search term
- Blur and sharpen are useful for social media preparation

### Cons

- Significant UI work: sliders, input fields, crop selection UI (crop especially needs a canvas-based drag interface)
- Each operation needs live preview feedback — re-running conversion on every slider change is expensive for large images
- Crop requires an interactive overlay on the preview image — complex frontend logic
- Ordering matters: resize then crop ≠ crop then resize
- The Worker message protocol grows significantly

### Architectural Considerations

- Extend `convert.rs` to accept a `ProcessingOptions` struct (or vector of operation descriptors) applied in sequence between decode and encode
- Use `serde` to pass options from JS through WASM boundary as JSON or via `JsValue`
- Operations struct in Rust:
  ```rust
  pub enum Operation {
      Resize { width: u32, height: u32, filter: &'static str },
      Crop { x: u32, y: u32, width: u32, height: u32 },
      Blur { sigma: f32 },
      Brighten { value: i32 },
      Contrast { value: f32 },
      HueRotate { degrees: i32 },
      Unsharpen { sigma: f32, threshold: i32 },
      Tile,
  }
  ```
- For live preview, use a "preview resolution" mode: before applying operations at full resolution, apply them to a downscaled thumbnail (e.g., 400px wide) and show that as preview. Only run full-resolution conversion on download.
- Crop UI requires a draggable selection overlay on the preview image — consider using a small library or building a simple canvas-based crop selector

### Bundle Size Impact

| Asset                                               | Delta (uncompressed) | Delta (gzipped) | Notes                                                                                                        |
| --------------------------------------------------- | -------------------- | --------------- | ------------------------------------------------------------------------------------------------------------ |
| WASM binary — `resize` (all filter types)           | +~30–55 KB           | +~10–18 KB      | Lanczos3, CatmullRom, Triangle, Gaussian sampling kernels                                                    |
| WASM binary — `blur` / `fast_blur`                  | +~20–35 KB           | +~7–12 KB       | Gaussian convolution; `fast_blur` is a box approximation                                                     |
| WASM binary — `unsharpen`                           | +~8–15 KB            | +~3–5 KB        | Calls blur internally + subtraction                                                                          |
| WASM binary — `crop_imm`                            | +~5–10 KB            | +~2–3 KB        | Sub-image view copy                                                                                          |
| WASM binary — `brighten` / `contrast` / `huerotate` | +~15–25 KB           | +~5–8 KB        | Per-pixel arithmetic on channel values                                                                       |
| WASM binary — `tile`                                | +~8–12 KB            | +~3–4 KB        | Repeated overlay calls                                                                                       |
| WASM binary — `serde_json` (options parsing)        | 0                    | 0               | `serde` already a dependency; `serde_json` adds ~40 KB uncompressed / ~15 KB gzipped if not already included |
| WASM binary — `processing.rs` glue                  | +~5–10 KB            | +~2–3 KB        | Dispatch enum, JSON deserialization, pipeline loop                                                           |
| **WASM total**                                      | **+~91–162 KB**      | **+~32–53 KB**  | Largest Rust addition after SVG; resize filters dominate                                                     |
| JavaScript                                          | +~5–8 KB             | +~2–3 KB        | Edit panel UI, sliders, crop overlay, debounce logic                                                         |
| CSS                                                 | +~3–6 KB             | +~1–2 KB        | Edit panel layout, slider styling, crop overlay                                                              |
| **Grand total**                                     | **+~99–176 KB**      | **+~35–58 KB**  | Significant but reasonable for a full processing pipeline                                                    |

> `serde_json` is the hidden cost — if it's not already in `Cargo.toml` (currently only `serde-wasm-bindgen` is used), adding it for JSON options parsing adds ~15 KB gzipped. Consider passing operations as a `JsValue` array instead of JSON strings to avoid this dependency entirely.

### Broad Todo List

**Rust (WASM):**

- [ ] Define `ProcessingOperation` enum and `ProcessingOptions` struct in a new `processing.rs` module
- [ ] Implement each operation using `imageops` functions
- [ ] Integrate the processing pipeline into `convert()` between decode and encode steps
- [ ] Add `process_image(input: &[u8], operations_json: &str, target_format: &str)` WASM export
- [ ] Add resize filter options: Nearest, Triangle (bilinear), CatmullRom, Gaussian, Lanczos3
- [ ] Add unit tests for each operation

**Frontend:**

- [ ] Design an "Edit" panel below the file upload section with tabs or sections for each operation group
- [ ] Resize section: width/height inputs with aspect ratio lock toggle, filter selector
- [ ] Crop section: interactive crop overlay on the preview (or numeric x/y/w/h inputs as fallback)
- [ ] Adjustments section: sliders for brightness, contrast, hue rotation, blur sigma
- [ ] Implement debounced (300ms) preview updates using low-resolution preview mode
- [ ] Implement "Reset" per operation and "Reset All"
- [ ] Serialize active operations as ordered JSON array and pass to Worker

### Additional Notes

- Resize is the highest-priority operation here — treat it as a separate, simpler feature first (Feature 3.5, so to speak) before building the full processing pipeline
- Lanczos3 is the highest quality resize filter but slowest; Nearest is fastest but pixelated — expose the choice for power users
- The tile operation has limited use but is fun and creative (creates a pattern from the image)
- `filter3x3()` (custom 3x3 kernel) is an advanced feature — skip for now unless there's clear user demand

---

## 11. Side-by-Side Before/After Comparison

**Difficulty: 3/5**

### Overview

Show the original and converted images side by side with a draggable split slider, allowing users to visually compare quality differences (especially useful for lossy conversions like PNG → JPEG, or heavy blur/compression).

### Pros

- High visual impact — makes the tool feel premium
- Directly addresses user question "how much quality did I lose?"
- Useful for demonstrating WebP savings vs JPEG, or JPEG quality tradeoffs
- Pure frontend feature — no Rust or Worker changes

### Cons

- Requires a draggable slider overlay on two stacked images — non-trivial canvas or CSS implementation
- Must handle images with different dimensions (post-resize operations change size)
- On mobile, the drag interaction needs touch event handling
- Two images displayed simultaneously doubles GPU/memory use for preview rendering

### Architectural Considerations

- Implementation options:
  - **CSS clip-path approach**: Stack two `<img>` elements, clip one with `clip-path: inset(0 0 0 X%)` where X tracks the slider position. Simple but requires images to be the same display size.
  - **Canvas approach**: Draw both images onto a `<canvas>`, clip at slider position. More flexible, handles different dimensions, but more code.
  - **Library**: `img-comparison-slider` web component is a good zero-config option (4 KB, no dependencies)
- The split view should replace the single preview when a conversion completes (or be a toggle)
- Store both `originalBlobUrl` and `convertedBlobUrl` in UI state — currently only `convertedBlobUrl` is stored

### Bundle Size Impact

| Asset                                              | Delta (uncompressed) | Delta (gzipped)  | Notes                                                    |
| -------------------------------------------------- | -------------------- | ---------------- | -------------------------------------------------------- |
| WASM binary                                        | 0                    | 0                | Pure frontend feature                                    |
| JavaScript (custom CSS clip-path)                  | +~3–5 KB             | +~1.2–2 KB       | Drag event handling, clip-path calculation, touch events |
| JavaScript (`img-comparison-slider` web component) | +~8–12 KB            | +~3–5 KB         | If using the library instead of custom code              |
| CSS                                                | +~2–4 KB             | +~0.8–1.5 KB     | Split view layout, drag handle styling                   |
| **Grand total (custom)**                           | **+~5–9 KB**         | **+~2–3.5 KB**   | Recommended — no new dependency                          |
| **Grand total (library)**                          | **+~10–16 KB**       | **+~3.8–6.5 KB** | Slightly larger but zero implementation risk             |

> The custom CSS clip-path approach is ~3 KB gzipped and has no runtime overhead beyond standard DOM events. The `img-comparison-slider` web component is battle-tested and worth the extra ~2 KB if you don't want to maintain drag logic + touch handling yourself.

### Broad Todo List

- [ ] Store `originalBlobUrl` alongside `convertedBlobUrl` in `ui.ts` state
- [ ] Add a toggle button "Split View / Single View" that appears after conversion
- [ ] Implement the split view component:
  - Option A: Use `img-comparison-slider` web component
  - Option B: Custom CSS clip-path implementation (preferred, no new dep)
- [ ] Add touch event support for mobile drag
- [ ] Show format labels above each panel ("Original: JPEG" / "Converted: PNG")
- [ ] Show file sizes under each panel
- [ ] Handle dimension mismatch (scale images to same display size)
- [ ] Ensure blob URLs for both images are revoked when user loads a new file

### Additional Notes

- The slider start position should default to 50% (center)
- For JPEG quality comparisons (after Feature 3), the split view becomes even more valuable — user can see quality vs. size tradeoff live
- Consider adding pixel zoom on hover/tap (magnifying glass effect) for comparing compression artifacts

---

## 12. Color Palette Extraction

**Difficulty: 3/5**

### Overview

Analyze the uploaded image and extract its dominant color palette (5–10 colors). Display the palette as swatches with hex codes, which users can copy. Useful for designers who want to extract brand colors from an image.

### Pros

- Unique feature that attracts designers, a high-value audience
- Genuinely useful: extracting brand colors from a logo or photo is a common design task
- Pure Rust computation — no new JS libraries needed
- Shareable/copyable hex codes add engagement (copy interaction)

### Cons

- Color quantization (finding N representative colors from millions) requires an algorithm — no built-in in the `image` crate
- K-means clustering is the standard approach but has variable runtime depending on image complexity and K value
- The `image` crate's `dither()` uses a simple quantization; for quality palette extraction, a dedicated crate like `color-thief` (Rust port of ColorThief) or implementing median cut is needed
- Running on full-resolution images in WASM can be slow for large images — downsample first

### Architectural Considerations

- Downsample image to ~100px before palette extraction to dramatically reduce computation (color accuracy is still good at this resolution)
- Use the `color-thief` Rust crate if WASM-compatible, or implement median cut algorithm directly
- Alternatively: use the `image` crate's color quantization used for GIF encoding (`NeuQuant` quantizer) to extract representative colors
- New WASM export: `extract_palette(input: &[u8], num_colors: u8) -> Result<JsValue, JsError>` returns `Vec<[u8; 3]>` (RGB triplets)
- Frontend renders swatches with copy-to-clipboard for hex codes

### Bundle Size Impact

| Asset                                                             | Delta (uncompressed) | Delta (gzipped) | Notes                                                            |
| ----------------------------------------------------------------- | -------------------- | --------------- | ---------------------------------------------------------------- |
| WASM binary — custom median cut                                   | +~25–45 KB           | +~9–16 KB       | Hand-rolled median cut algorithm + downsampling step             |
| WASM binary — `color-thief` crate (if WASM-compatible)            | +~40–80 KB           | +~14–28 KB      | Includes k-means or median cut + Rust overhead                   |
| WASM binary — using `NeuQuant` (already in `image` crate for GIF) | 0–5 KB               | 0–2 KB          | Reuse existing quantizer — nearly free if GIF feature is enabled |
| JavaScript                                                        | +~1.5–3 KB           | +~0.6–1.2 KB    | Swatch rendering, clipboard copy, "Copy all" button              |
| CSS                                                               | +~1–2 KB             | +~0.4–0.8 KB    | Swatch grid layout                                               |
| **Grand total (NeuQuant reuse)**                                  | **+~2.5–5 KB**       | **+~1–3 KB**    | Near-free if you piggyback on the GIF quantizer                  |
| **Grand total (custom median cut)**                               | **+~27.5–50 KB**     | **+~10–18 KB**  | Good quality, no new dependencies                                |
| **Grand total (color-thief)**                                     | **+~42–85 KB**       | **+~15–30 KB**  | Best quality, highest cost                                       |

> **Recommended path**: First try reusing `NeuQuant` (already compiled in for GIF encoding) — it's already in the binary and produces decent palettes. If quality is insufficient, implement median cut as a ~200-line Rust function. Avoid adding `color-thief` as a dependency unless it demonstrably outperforms the custom implementation.

### Broad Todo List

**Rust (WASM):**

- [ ] Evaluate `color-thief` crate for WASM compatibility; fall back to implementing median cut if needed
- [ ] Implement `extract_palette()` with input downsampling (resize to 100px width first)
- [ ] Add WASM export returning array of RGB hex strings
- [ ] Add unit tests for palette extraction on known images

**Frontend:**

- [ ] Display palette swatches below the image preview after upload (or run on demand)
- [ ] Each swatch shows hex code; click copies to clipboard
- [ ] Show a "Copy all" button that copies the full palette as comma-separated hex codes
- [ ] Add a subtle loading state while palette is computed
- [ ] Track `palette_copied` event in PostHog

### Additional Notes

- 6–8 colors is the sweet spot for palette size — too few misses nuance, too many becomes noise
- For images with few distinct colors (logos, icons), the palette result is very clean and useful
- The palette could be shown as CSS custom properties output (e.g., `--color-primary: #FF6B6B`) for developers
- A potential companion to the "Side-by-Side Comparison" feature — show palette changing as you adjust hue/saturation

---

## 13. PWA Support — Offline Usage

**Difficulty: 3/5**

### Overview

Convert the app into a Progressive Web App (PWA) with a service worker that caches the WASM module and static assets. Enables offline usage and "Add to Home Screen" installation on mobile.

### Pros

- "Works offline" is a genuine differentiator and a privacy-reinforcing message
- PWA installation improves repeat-visit engagement
- Service worker caching improves load performance for return visitors (WASM module cached after first visit)
- WASM modules are large (~1–3 MB); caching them dramatically reduces repeat-load time

### Cons

- Service worker lifecycle is notoriously tricky: cache invalidation on deploys, update UX, error handling for cache misses
- WASM binary and JS bundle must be served with correct CORS headers (already the case for WASM, but service workers add a layer)
- The `COOP`/`COEP` headers required for `SharedArrayBuffer` (for future cancellation/threading) interact with service workers — need to be careful
- Vite has limited first-class PWA support out of the box; use `vite-plugin-pwa` for full support

### Architectural Considerations

- Generate a `manifest.json` (app name, icons, theme color, display mode)
- Write a service worker using Workbox (Google's SW library) or manually — Workbox handles cache strategies cleanly
- Cache strategy: Cache-first for WASM binary, Network-first for HTML (to pick up updates)
- Register the SW in `main.ts` (`navigator.serviceWorker.register('/sw.js')`)
- Vite: add a custom `sw.js` entry point or use `vite-plugin-pwa` to include the SW file

### Bundle Size Impact

| Asset                                | Delta (uncompressed) | Delta (gzipped) | Notes                                                              |
| ------------------------------------ | -------------------- | --------------- | ------------------------------------------------------------------ |
| WASM binary                          | 0                    | 0               | No Rust changes                                                    |
| JavaScript — service worker (manual) | +~4–8 KB             | +~2–3 KB        | Fetch handler, cache strategy, update logic                        |
| JavaScript — Workbox runtime         | +~60–100 KB          | +~22–38 KB      | If using Workbox; includes all strategy modules                    |
| JavaScript — SW registration         | +~0.3–0.5 KB         | +~0.2 KB        | `navigator.serviceWorker.register()` call in `main.ts`             |
| `manifest.json`                      | +~0.5–1 KB           | +~0.3 KB        | Separate HTTP request, fetched once                                |
| PWA icons (192×192 + 512×512 PNG)    | +~25–60 KB           | n/a             | PNG icons; served separately, cached by SW                         |
| **Grand total (manual SW)**          | **+~30–70 KB**       | **+~2.5–4 KB**  | Only SW registration JS is in the critical path; SW + icons cached |
| **Grand total (Workbox)**            | **+~86–162 KB**      | **+~22–41 KB**  | Workbox runtime loads in the SW context, not main thread           |

> The service worker and icons are **not** part of the main JS bundle — they are separate resources fetched after the page loads. The critical-path cost is only the SW registration snippet (~200 bytes). Workbox's runtime executes inside the service worker process, not on the main thread. Choose Workbox for correctness; choose a manual SW if bundle minimalism matters.

### Broad Todo List

- [ ] Create `web/public/manifest.json` with app metadata, icons, colors
- [ ] Create icons at 192×192 and 512×512 (PNG) for PWA install
- [ ] Add `<link rel="manifest">` and `<meta name="theme-color">` to `index.html`
- [ ] Write `sw.js` service worker (use Workbox for simplicity):
  - Precache WASM binary, JS bundle, CSS, HTML
  - Cache-first for assets, Network-first for HTML
- [ ] Register service worker in `main.ts`
- [ ] Handle service worker updates: show "Update available — reload" banner
- [ ] Test offline functionality: disconnect network, verify conversion still works
- [ ] Test `Add to Home Screen` on Android Chrome and iOS Safari
- [ ] Verify cache-busting works on deploy (Vite adds content hashes to filenames — SW should update automatically)

### Additional Notes

- The WASM module is the most important asset to cache — it's large and the app is completely non-functional without it
- iOS Safari has PWA quirks: no push notifications, limited service worker storage quota, splash screen requires specific icon sizes
- The "offline" badge or indicator ("Working offline") is a nice UX touch when the network is unavailable
- PWA installation prompt can be intercepted with `beforeinstallprompt` event to show a custom "Install App" button

---

## 14. Image Watermarking

**Difficulty: 3.5/5**

### Overview

Allow users to add a text or image watermark to the output image before conversion. Common use cases: copyright text on exported photos, logos overlaid on product images.

### Pros

- High practical value for photographers and content creators
- The `imageops::overlay()` function handles image composition in Rust
- Text rendering can be done via the `ab_glyph` or `rusttype` crates (pure Rust font rendering)
- Differentiates from simple format converters

### Cons

- Text watermarking requires a font renderer — adds significant binary size (font data + renderer)
- Font must be bundled (can't use system fonts in WASM) — even a minimal font is ~100–500 KB
- Image watermark (logo overlay) requires the user to upload a second file — complicates the UI
- Watermark positioning (corners, center, tiled) requires a coordinate system tied to the output dimensions
- The UI surface area grows: text input, font size, opacity, position, color

### Architectural Considerations

- For text watermarking: use `ab_glyph` for glyph rendering + `imageproc` crate's `draw_text_mut()` (or implement manually)
- For image watermarking: accept a second `logo: &[u8]` input, decode it, use `imageops::overlay()` at the specified position
- Bundle a minimal font file (e.g., Roboto or Noto Sans subset) as a `static` byte array compiled into the WASM binary
- New WASM exports:
  - `add_text_watermark(input: &[u8], text: &str, options_json: &str) -> Result<Vec<u8>, JsError>`
  - `add_image_watermark(input: &[u8], watermark: &[u8], options_json: &str) -> Result<Vec<u8>, JsError>`
- Options include: position (9 anchor points), opacity (0.0–1.0), padding, font size (for text)

### Bundle Size Impact

| Asset                                     | Delta (uncompressed) | Delta (gzipped) | Notes                                                                             |
| ----------------------------------------- | -------------------- | --------------- | --------------------------------------------------------------------------------- |
| WASM binary — `ab_glyph`                  | +~60–100 KB          | +~22–35 KB      | TTF/OTF glyph rasterizer                                                          |
| WASM binary — `imageproc` (if used)       | +~80–150 KB          | +~28–52 KB      | General image processing; only `draw_text_mut` needed — consider inlining instead |
| WASM binary — bundled font (Latin subset) | +~40–80 KB           | +~25–50 KB      | Stored in WASM data segment as `static [u8]`                                      |
| WASM binary — watermark logic             | +~8–15 KB            | +~3–5 KB        | Position math, opacity blending, `imageops::overlay()`                            |
| **WASM total**                            | **+~108–345 KB**     | **+~50–142 KB** | Range depends on whether `imageproc` is added or inlined                          |
| JavaScript                                | +~2–4 KB             | +~0.8–1.5 KB    | Watermark UI (text input, sliders, position picker)                               |
| CSS                                       | +~1–2 KB             | +~0.4–0.8 KB    | Collapsible watermark section                                                     |
| **Grand total**                           | **+~111–351 KB**     | **+~51–144 KB** | Font data and `imageproc` are the main unknowns                                   |

> **Key decision**: avoid adding all of `imageproc` just for `draw_text_mut`. The function is ~200 lines in imageproc's source — copy it directly into `lib.rs` to avoid the 28–52 KB `imageproc` overhead. Also consider serving the font file as a **separate fetch** (`/fonts/watermark.woff2`) rather than embedding it in the WASM binary, which keeps the initial WASM load fast and only incurs the font cost when the user enables watermarking.

### Broad Todo List

**Rust (WASM):**

- [ ] Add `ab_glyph` and a bundled font to `Cargo.toml`
- [ ] Add `imageproc` or implement `draw_text_mut()` directly
- [ ] Implement `add_text_watermark()` with position, size, color, opacity options
- [ ] Implement `add_image_watermark()` using `imageops::overlay()` with alpha blending
- [ ] Add unit tests for watermark placement (verify pixel values at expected positions)

**Frontend:**

- [ ] Add a "Watermark" section to the UI (collapsible, off by default)
- [ ] Text watermark: text input, font size slider, color picker, position selector (3×3 grid), opacity slider
- [ ] Image watermark: second file picker for logo, size (% of output width), position, opacity
- [ ] Show watermark preview in real-time (using debounced re-conversion of preview)
- [ ] Clearly label that watermark is applied to the converted output, not the original

### Additional Notes

- Start with text watermarking only (simpler) before tackling image watermarking
- Bundled font size concern: a subset of Roboto covering Latin characters is ~15–30 KB — very manageable
- Tiled watermark (repeated across the entire image) is a common pattern — add as a position option
- Opacity control is critical: a fully opaque watermark destroys the image; 20–40% is typical

---

## 15. Real Progress Reporting from Rust

**Difficulty: 3.5/5**

### Overview

Replace the estimated progress bar with actual decode/encode progress reported from the Rust side via `wasm-bindgen` callbacks. Provides accurate progress for large images and removes the "90% stall" behavior.

### Pros

- Accurate progress is a better UX than the estimated approximation
- Eliminates the "stuck at 90%" problem for images that take longer than estimated
- Showcases Rust↔JS interop capabilities

### Cons

- The `image` crate's decoders/encoders don't natively expose progress callbacks — this requires wrapping or instrumenting them, which is complex
- Implementing progress requires calling back into JS mid-conversion, which involves `wasm-bindgen` closures — these have lifetime constraints that make them tricky to pass into deeply nested calls
- Each callback crosses the WASM boundary, which has overhead — too many callbacks hurts performance
- If implemented naively, it changes the Rust function signatures significantly

### Architectural Considerations

- Strategy: use checkpoints rather than per-row progress. Report 4–6 progress events: `0%` (start), `25%` (decoding started), `50%` (decoding complete), `75%` (encoding started), `90%` (encoding complete), `100%` (done)
- In Rust: use a `Fn(f32)` callback passed from JS via `wasm-bindgen` closure. Call it at each checkpoint.
- `wasm-bindgen` closures: `js_sys::Function` can be passed from JS and called in Rust via `apply()`
- Worker protocol: instead of a single `ConversionComplete` message, send multiple `ConversionProgress { percent: f32 }` messages, then a final `ConversionComplete`
- Alternatively: use a `SharedArrayBuffer` + Atomics for a shared progress counter (simpler, no callbacks needed, but requires COOP/COEP security headers)

### Bundle Size Impact

| Asset                                     | Delta (uncompressed) | Delta (gzipped)  | Notes                                                                            |
| ----------------------------------------- | -------------------- | ---------------- | -------------------------------------------------------------------------------- |
| WASM binary — `js_sys::Function` callback | +~3–8 KB             | +~1–3 KB         | `js_sys` is already a transitive dependency of `wasm-bindgen` — minimal addition |
| JavaScript                                | +~1–2 KB             | +~0.4–0.8 KB     | `ConversionProgress` message type, updated progress bar handler                  |
| CSS                                       | 0                    | 0                | No visual changes — same progress bar                                            |
| **Grand total**                           | **+~4–10 KB**        | **+~1.4–3.8 KB** | Very low cost; `js_sys` is already in the dependency tree                        |

> `js_sys` is already a transitive dependency of `wasm-bindgen`, so calling `js_sys::Function` from Rust compiles in code that is likely already present. The actual binary delta depends on which `js_sys` APIs are currently tree-shaken out.

### Broad Todo List

**Rust (WASM):**

- [ ] Add `progress_callback: Option<js_sys::Function>` parameter to `convert_image()`
- [ ] Call the callback at decode-start, decode-end, encode-start, encode-end checkpoints
- [ ] Handle `None` callback gracefully (existing callers without callback still work)
- [ ] Add a typed wrapper struct for the progress function to avoid raw `js_sys::Function` use

**Worker (TS):**

- [ ] Create a `progressCallback` function that posts `ConversionProgress` messages to main thread
- [ ] Pass callback as a `js_sys::Function`-compatible value when calling `convert_image()`
- [ ] Ensure callback is properly cleaned up after conversion completes

**Frontend:**

- [ ] Handle `ConversionProgress` message type in `main.ts` and forward to `ui.ts`
- [ ] Update progress bar in `ui.ts` to use actual progress values instead of the estimated model
- [ ] Keep the estimated model as a floor (progress bar never goes backwards)

### Additional Notes

- The `SharedArrayBuffer` approach is cleaner if COOP/COEP headers are already configured — check deployment headers before choosing approach
- For V1 of real progress, the 6-checkpoint approach is sufficient — per-row progress is overkill and expensive
- Real progress reporting is most valuable for large images (>5 MP) — for small images the conversion is near-instant anyway

---

## 16. React Frontend Migration

**Difficulty: 4/5**

### Overview

Refactor the frontend from vanilla TypeScript to React (or a lightweight alternative like Preact). The current vanilla TS works well for the MVP, but as more features are added (image processing pipeline, batch mode, side-by-side comparison, watermarking), managing DOM state manually becomes error-prone.

### Pros

- React's component model is well-suited to the growing UI: each operation (resize, crop, watermark) becomes a self-contained component
- State management becomes explicit (`useState`, `useReducer`) vs implicit DOM mutation
- Easier to add complex interactions (drag-to-crop, before/after slider) with React component libraries
- Vastly better developer experience for UI iteration
- Large ecosystem for accessible UI primitives (Radix UI, shadcn/ui)

### Cons

- Significant migration effort — every file in `web/src/` needs rewriting
- React adds bundle size (~40–50 KB gzipped for React + ReactDOM; ~4 KB for Preact)
- The current Vite setup works well with vanilla TS; React/Preact requires adding the appropriate Vite plugin (e.g., `@vitejs/plugin-react` or `@preact/preset-vite`)
- SEO: the current vanilla TS approach has all static content in `index.html`, fully crawlable. React's client-side rendering may require SSR or static generation (Next.js) to preserve SEO — significant additional complexity
- The existing `ImageConverter` class and Worker integration are clean and can be preserved as-is; the migration touches only the UI layer

### Architectural Considerations

- **Preact over React**: Preact is API-compatible with React but 1/10th the size (~3 KB). For a tool with no React ecosystem dependencies, Preact is the right choice.
- **Bundler**: Vite — better React/Preact DX, faster HMR, better PWA plugin support (see Feature 13), first-class WASM support
- **SEO risk**: The format-specific landing pages (Feature 6) depend on static HTML content. With a React SPA, this breaks unless using Next.js or Astro. Consider Astro as the frontend framework: static HTML generation + React/Preact islands for the interactive converter.
- **Component structure**:
  ```
  App
  ├── ThemeProvider
  ├── DropZone
  ├── FormatSelector
  ├── ProcessingPanel
  │   ├── TransformControls
  │   ├── ResizeControls
  │   ├── AdjustmentSliders
  │   └── WatermarkControls
  ├── ProgressBar
  ├── ComparisonView
  │   ├── BeforePanel
  │   └── AfterPanel
  └── MetadataPanel
  ```
- The `ImageConverter` class in `main.ts` can be exposed via React Context instead of `window.__converter`
- Keep the Web Worker and Rust WASM layer completely unchanged

### Bundle Size Impact

| Asset                                 | Delta (uncompressed) | Delta (gzipped)  | Notes                                                               |
| ------------------------------------- | -------------------- | ---------------- | ------------------------------------------------------------------- |
| WASM binary                           | 0                    | 0                | Worker + Rust layer untouched                                       |
| JavaScript — **Preact** (recommended) | +~8–12 KB            | +~3–5 KB         | Preact core (~3 KB) + hooks (~1 KB); app code stays same size       |
| JavaScript — **React + ReactDOM**     | +~280–350 KB         | +~100–130 KB     | React 18 production build; app code stays same size                 |
| JavaScript — **Astro island**         | +~15–25 KB           | +~5–9 KB         | Astro runtime for hydrating the converter island                    |
| CSS                                   | 0                    | 0                | Tailwind classes remain the same                                    |
| Vite (Rollup-based bundling)          | −5–15%               | −5–15%           | Vite's Rollup-based tree-shaking typically produces smaller bundles |
| **Grand total (Preact)**              | **+~8–12 KB**        | **+~3–5 KB**     | Strongly recommended                                                |
| **Grand total (React)**               | **+~280–350 KB**     | **+~100–130 KB** | Avoid unless ecosystem lock-in is required                          |

> **Preact is the clear choice.** It adds ~3–5 KB gzipped over the current vanilla TS bundle — essentially free. React adds 100–130 KB, more than doubling the current JS payload. The Web Worker + WASM layer is completely unaffected by this migration either way, since it runs in a separate thread context.

### Broad Todo List

- [ ] Evaluate and decide: React vs. Preact, SPA vs. Astro
- [ ] Set up new build toolchain (Vite + Preact recommended)
- [ ] Create project structure with component directories
- [ ] Migrate `ImageConverter` class to a React Context + custom hooks (`useConverter`, `useWorker`)
- [ ] Migrate `ui.ts` state to React state (`useState`/`useReducer`)
- [ ] Rewrite each UI section as a React component (one PR per component):
  - [ ] `DropZone` component
  - [ ] `FormatSelector` component
  - [ ] `ProgressBar` component
  - [ ] `ImagePreview` / `ComparisonView` component
  - [ ] `MetadataPanel` component
  - [ ] `ErrorDisplay` component
- [ ] Migrate `analytics.ts` to work as a React hook (`useAnalytics`)
- [ ] Re-implement dark mode using React context (or CSS-only toggle)
- [ ] Update Playwright E2E tests to work with new component structure
- [ ] Verify Core Web Vitals are not degraded (LCP, CLS, INP)
- [ ] If using Vite, update `package.json` scripts accordingly

### Additional Notes

- **Recommendation**: If the app is going to get more than 3–4 of the features in this roadmap, migrate to Preact + Vite sooner rather than later. The ROI increases with every feature added.
- Astro is worth considering: it renders the page shell (H1, FAQ, supported formats) as static HTML at build time, while the converter tool is a React/Preact island. Best of both worlds for SEO + component ergonomics.
- The migration can be done incrementally: start with Vite + Preact, port the core converter first, then port each UI section. The Worker and WASM layer don't need to change at all.

---

## 17. Batch Processing

**Difficulty: 4/5**

### Overview

Allow users to upload and convert multiple images at once. Files are processed sequentially in the Web Worker and results are available for individual or bulk download.

### Pros

- Batch processing is listed as the top stretch goal for good reason — it dramatically increases utility for power users
- A user converting 50 holiday photos to WebP needs batch mode
- The underlying Worker and WASM code requires no changes — just sequential calls
- A "Download all as ZIP" capability makes the feature complete

### Cons

- The UI shifts from a single-file flow to a multi-file queue — significant UI redesign
- ZIP creation in the browser requires a library (`fflate` or `JSZip`) — adds dependency
- Memory management becomes critical: holding all converted images in memory simultaneously is dangerous for large batches
- Error handling per file (some succeed, some fail) needs clear UX
- The current Worker architecture processes one file at a time — batch mode means managing a queue of requests

### Architectural Considerations

- UI model: a file list/queue with per-file status (pending, converting, done, error) and a progress indicator per file
- Processing model: sequential (one conversion at a time in the Worker) — simpler and avoids memory buildup
- Memory model: stream results out as they complete rather than buffering all. Create and immediately revoke blob URLs for individual downloads; only hold all bytes in memory when the user clicks "Download all as ZIP"
- ZIP generation: use `fflate` (fast, WASM-based) or `JSZip` in the main thread to create a ZIP from collected byte arrays
- ZIP streaming: for very large batches, use `fflate`'s streaming ZIP API to pipe converted bytes directly into the ZIP without holding all files in memory simultaneously
- New Worker message types: `BatchConvertStart`, `BatchConvertProgress { index, total, result }`, `BatchConvertComplete`
- The format selection and processing options (from Feature 10) apply uniformly to all files in the batch (same target format, same quality, etc.)

### Bundle Size Impact

| Asset                              | Delta (uncompressed) | Delta (gzipped)  | Notes                                                     |
| ---------------------------------- | -------------------- | ---------------- | --------------------------------------------------------- |
| WASM binary                        | 0                    | 0                | Batch uses existing `convert_image()` sequentially        |
| JavaScript — batch queue logic     | +~3–5 KB             | +~1.2–2 KB       | Queue manager, status tracking, progress messages         |
| JavaScript — `fflate` ZIP library  | +~25–35 KB           | +~9–12 KB        | Fast ZIP creation; streams output to avoid memory buildup |
| JavaScript — `JSZip` (alternative) | +~80–100 KB          | +~30–38 KB       | Heavier alternative; avoid in favour of `fflate`          |
| CSS                                | +~2–4 KB             | +~0.8–1.5 KB     | File queue list, status badges, progress per file         |
| **Grand total (`fflate`)**         | **+~30–44 KB**       | **+~11–15.5 KB** | Reasonable cost; `fflate` dominates                       |
| **Grand total (`JSZip`)**          | **+~85–109 KB**      | **+~31–41.5 KB** | Avoid                                                     |

> `fflate` is the right choice — it's ~3× smaller than `JSZip` and has a streaming API that avoids holding all converted files in memory simultaneously. For batches that don't need ZIP (individual downloads only), the `fflate` cost can be deferred until the user first clicks "Download all as ZIP" via dynamic `import()`.

### Broad Todo List

**Worker (TS):**

- [ ] Add `BatchConvertRequest` and `BatchConvertProgress` message types to `worker-types.ts`
- [ ] Implement batch processing loop in `worker.ts`: iterate files, convert each, post progress after each
- [ ] Support cancellation of in-progress batch (check a cancellation flag between files)

**Frontend:**

- [ ] Redesign file input area to support multi-file selection (`multiple` attribute on `<input type="file">`)
- [ ] Build a file queue UI component: list of filenames, status badges, individual download buttons
- [ ] Show overall batch progress (e.g., "Converting 3 of 12...")
- [ ] Per-file progress/status indicator (queued, converting, done ✓, error ✗)
- [ ] Add "Download all as ZIP" button (enabled after at least one file is converted)
- [ ] Implement ZIP creation using `fflate` streaming API
- [ ] Allow removing individual files from the queue before or during processing
- [ ] Handle mixed-format input batches (each file auto-detected, all converted to the selected output format)
- [ ] Update PostHog events for batch: `batch_started { file_count }`, `batch_completed { success_count, error_count, total_ms }`

### Additional Notes

- The "Download all as ZIP" button is the most user-valuable part of batch mode — implement it before optimizing the queue UI
- Individual file download buttons should appear as each file finishes (don't wait for the full batch)
- For large batches (>20 files), show a "Pause" button to let users stop and download completed files
- Batch processing combined with the image processing pipeline (Feature 10) — e.g., "resize all images to 1920px wide and convert to WebP" — is a killer workflow

---

## 18. Raise File Size and Memory Limits

**Difficulty: 4.5/5**

### Overview

Increase the current 200 MB file size limit and 100 MP pixel limit to accommodate professional workflows (RAW photo editing, high-resolution scans, print production files).

### Pros

- Enables professional use cases currently blocked (200 MB RAW TIFF exports, 200 MP medium format scans)
- Keeps the tool competitive with desktop applications
- No new Rust logic — just adjusted thresholds and better failure handling

### Cons

- Mobile reliability degrades significantly above 200 MB (iOS Jetsam OOM kills are silent and unrecoverable)
- WASM 4 GB linear memory ceiling is a hard architectural limit on wasm32
- Large allocations increase time-to-convert (decoding a 500 MB file takes several seconds)
- Chunked/tiled processing (the real solution) is a significant research and implementation effort
- Memory64 (wasm64) raises the ceiling to 16 GB but has no Safari support and a 10–100% performance penalty

### Architectural Considerations

- **Tier approach**: Raise desktop limits to 500 MB / 375 MP; keep mobile limits at 100 MB / 50 MP
- **Mobile detection**: Use `navigator.userAgentData.mobile` or `screen.width` + device pixel ratio to determine mobile and apply lower limits
- **Tiled processing (long-term)**: Process image in horizontal strips — decode one strip at a time, encode it, free it, process next strip. Requires format-specific strip decoders (the `image` crate doesn't support this natively — would need custom codec wrappers for JPEG/PNG at minimum). This removes the WASM memory bottleneck entirely.
- **Streaming reads via `Blob.slice()`**: Read the file in chunks from JS using `Blob.slice()` to avoid loading the full file into WASM memory at once. Useful for very large sequential formats.
- **Memory64 (future)**: Track WASM GC and memory64 proposal status; adopt when Safari support lands.

### Bundle Size Impact

| Asset                              | Delta (uncompressed) | Delta (gzipped)  | Notes                                                            |
| ---------------------------------- | -------------------- | ---------------- | ---------------------------------------------------------------- |
| WASM binary                        | 0                    | 0                | No new logic — just changed threshold constants                  |
| JavaScript                         | +~0.3–0.5 KB         | +~0.1–0.2 KB     | Mobile detection, updated limit constants, new warning messages  |
| CSS                                | 0                    | 0                | Existing warning UI reused                                       |
| **Grand total (near-term)**        | **+~0.3–0.5 KB**     | **+~0.1–0.2 KB** | Essentially free                                                 |
| **Grand total (tiled processing)** | +~80–200 KB WASM     | +~28–70 KB       | Custom strip decoders for JPEG/PNG are significant new Rust code |

> The threshold changes themselves are free. The hard work — tiled/chunked processing — requires new codec wrappers in Rust that add meaningful binary size. A custom JPEG strip decoder (`mozjpeg` bindings) would add ~50–150 KB WASM gzipped on its own. This is a research-heavy feature where actual size impact depends on the chosen approach.

### Broad Todo List

**Near-term (raise limits without tiling):**

- [ ] Research actual tested limits on desktop Chrome, Firefox, Safari (16+ GB RAM machines)
- [ ] Detect mobile vs desktop in `ui.ts` and apply different limits
- [ ] Raise desktop limits to 500 MB file size / 375 MP pixels
- [ ] Add progressive warnings: "This is a large file — conversion may take 10–30 seconds"
- [ ] Improve OOM error messages: detect `RangeError` from WASM `memory.grow()` and show "Image too large for your device's memory" instead of a generic error

**Long-term (tiled processing):**

- [ ] Research which image formats the `image` crate supports for strip/tile decoding (TIFF has native strip support)
- [ ] Prototype tiled JPEG decoding using `mozjpeg` or a custom JPEG scan parser
- [ ] Implement tiled PNG encoding using `png` crate's streaming encoder
- [ ] Design the cross-strip state management in Rust
- [ ] Benchmark memory usage at 500 MP using tiled mode vs current in-memory mode

### Additional Notes

- The 100 MP / 200 MB limits are conservative — real-world testing shows desktop Chrome handles 300–400 MP reliably on 16 GB machines
- The mobile limit is the real constraint — iOS is aggressive about killing processes. A 50 MB file size / 30 MP pixel limit is safer for mobile
- The user experience for "too large" should be empathetic: explain why it failed and suggest alternatives (use a lower quality setting, resize first, use the desktop version)

---

## 19. Worker Pool for Parallel Batch Conversion

**Difficulty: 4.5/5**

### Overview

Run multiple Web Workers in parallel, each with their own WASM module instance, to convert multiple images simultaneously and fully utilize multi-core CPUs for batch processing.

### Pros

- Dramatically faster batch conversion on multi-core machines (4–8 cores = 4–8x throughput)
- Modern CPUs have abundant cores — single-threaded batch is leaving performance on the table
- Each Worker is independent — no shared state, no concurrency primitives needed

### Cons

- Each Worker loads a full copy of the WASM module (~1–3 MB) — 4 workers = 4–12 MB memory overhead
- Coordinating a work queue across workers requires a scheduler in the main thread
- If all workers decode large images simultaneously, memory usage multiplies by worker count
- Workers must be dynamically created and destroyed (or pooled) — lifecycle management is complex
- Error handling becomes harder when failures occur across multiple parallel workers

### Architectural Considerations

- **Pool size**: Auto-detect from `navigator.hardwareConcurrency` — use `Math.min(hardwareConcurrency, 4)` as the pool size (cap at 4 to avoid excessive memory use)
- **Work queue**: Main thread maintains a queue of pending conversion tasks. When a Worker completes and becomes free, the main thread assigns the next task via `postMessage`. This is a classic thread pool pattern.
- **Worker reuse**: Workers stay alive across tasks (don't terminate and recreate) since WASM initialization is expensive (~100–200 ms)
- **WASM module sharing**: `WebAssembly.Module` objects are transferable and cloneable. Compile once and pass the compiled module to each Worker via `postMessage([module], [module])` instead of re-compiling from bytes. Reduces initialization time for subsequent Workers.
- **Memory cap**: Enforce a per-worker concurrency limit based on available memory. If a 24 MP image uses ~300 MB, limit concurrent large-image conversions to 2 even if the pool has 4 workers.

### Bundle Size Impact

| Asset                             | Delta (uncompressed) | Delta (gzipped)  | Notes                                                    |
| --------------------------------- | -------------------- | ---------------- | -------------------------------------------------------- |
| WASM binary                       | 0                    | 0                | Compiled module is shared — not duplicated in the bundle |
| JavaScript — `WorkerPool` class   | +~3–5 KB             | +~1.2–2 KB       | Pool manager, task queue, Worker lifecycle               |
| JavaScript — modified `worker.ts` | +~0.5–1 KB           | +~0.2–0.4 KB     | Accept pre-compiled module via `init(module)`            |
| CSS                               | 0                    | 0                | No new UI (pool is transparent to the user)              |
| **Grand total (bundle)**          | **+~3.5–6 KB**       | **+~1.4–2.4 KB** | Negligible on-disk cost                                  |
| **Runtime memory impact**         | N/A                  | N/A              | +~1.5–2 MB RAM per additional Worker instance at runtime |

> The bundle size impact is trivial — the `WorkerPool` class is pure orchestration logic. The real cost is **runtime memory**: each Worker loads a full WASM linear memory space (~1.5–2 MB baseline, growing with image size). A 4-Worker pool processing four 12 MP images concurrently could use 1–2 GB RAM. `WebAssembly.Module` sharing (via `postMessage` transfer) eliminates re-compilation overhead but does not reduce per-Worker memory consumption since each Worker gets its own heap.

### Broad Todo List

**Architecture:**

- [ ] Design a `WorkerPool` class in `main.ts`:
  - Creates N Worker instances on initialization
  - Maintains a task queue and tracks which Workers are busy
  - Dispatches tasks to free Workers; queues tasks when all Workers are busy
- [ ] Pass compiled `WebAssembly.Module` to each Worker to avoid re-compilation overhead
- [ ] Design `WorkerPool.convert(data, format, options)` API that returns a Promise, resolving when the Worker completes
- [ ] Handle Worker errors — remove crashed Workers from the pool, recreate

**Worker (TS):**

- [ ] Modify `worker.ts` to accept a pre-compiled WASM module via `init(compiledModule)` instead of always fetching and compiling from URL

**Frontend:**

- [ ] Wire batch processing (Feature 17) to use `WorkerPool` instead of the single Worker
- [ ] Show per-worker utilization if useful for debugging (or as a fun "x cores working" indicator)

### Additional Notes

- A worker pool is only meaningful with batch processing (Feature 17) — implement batch first
- The pool size auto-detection should account for mobile: cap at 2 Workers on mobile to avoid memory pressure
- `WebAssembly.Module` sharing via transfer is a key optimization — without it, each Worker takes 200ms+ to initialize, negating the parallel benefit for small batches
- This is the closest we can get to true parallelism in WASM without `SharedArrayBuffer` + WASM threads (which requires COOP/COEP headers and is not universally supported)

---

## Summary Table

Bundle size deltas are **gzipped** (over-the-wire). WASM and JS deltas are broken out separately since WASM is fetched once and cached, while JS is part of the critical render path.

| #   | Feature                                             | Difficulty | Impact    | Effort    | WASM Δ (gz)   | JS/CSS Δ (gz) | Total Δ (gz)  | Done |
| --- | --------------------------------------------------- | ---------- | --------- | --------- | ------------- | ------------- | ------------- | ---- |
| 1   | Dark Mode                                           | 1/5        | Medium    | Low       | 0             | +~4–7 KB      | +~4–7 KB      | [ ]  |
| 2   | Paste from Clipboard                                | 1.5/5      | High      | Low       | 0             | +~0.5–1 KB    | +~0.5–1 KB    | [x]  |
| 3   | JPEG Quality Slider                                 | 2/5        | High      | Low       | +~1–3 KB      | +~1–1.5 KB    | +~2–5 KB      | [x]  |
| 4   | Tier 2 Formats (TIFF, ICO, TGA, QOI)                | 2/5        | Medium    | Low       | +~93–145 KB   | +~0.5–1 KB    | +~94–146 KB   | [x]  |
| 5   | Simple Transforms (Flip, Rotate, Grayscale, Invert) | 2/5        | High      | Medium    | +~16–29 KB    | +~2–3.5 KB    | +~18–32 KB    | [ ]  |
| 6   | Format Landing Pages (SEO)                          | 2.5/5      | High      | Medium    | 0             | +~0.3–0.5 KB  | +~0.3–0.5 KB  | [x]  |
| 7   | SVG Rasterization                                   | 2.5/5      | Medium    | Medium    | +~540 KB–1 MB | +~0.5–1 KB    | +~541 KB–1 MB | [ ]  |
| 8   | Image Metadata + EXIF Display                       | 2.5/5      | Medium    | Medium    | +~28–45 KB    | +~1.2–2 KB    | +~29–47 KB    | [ ]  |
| 9   | Compression Benchmark                               | 2.5/5      | High      | Medium    | 0             | +~1.2–2.3 KB  | +~1.2–2.3 KB  | [x]  |
| 10  | Parameterized Processing (Resize, Crop, Blur, etc.) | 3/5        | Very High | High      | +~32–53 KB    | +~3–5 KB      | +~35–58 KB    | [ ]  |
| 11  | Side-by-Side Comparison                             | 3/5        | High      | Medium    | 0             | +~2–3.5 KB    | +~2–3.5 KB    | [ ]  |
| 12  | Color Palette Extraction                            | 3/5        | Medium    | Medium    | +~0–28 KB     | +~1–2 KB      | +~1–30 KB     | [ ]  |
| 13  | PWA / Offline Support                               | 3/5        | Medium    | High      | 0             | +~2.5–4 KB†   | +~2.5–4 KB†   | [ ]  |
| 14  | Image Watermarking                                  | 3.5/5      | Medium    | High      | +~50–142 KB   | +~1.2–2.3 KB  | +~51–144 KB   | [ ]  |
| 15  | Real Progress Reporting                             | 3.5/5      | Low       | High      | +~1–3 KB      | +~0.4–0.8 KB  | +~1.4–3.8 KB  | [ ]  |
| 16  | React Migration (Preact)                            | 4/5        | Medium    | Very High | 0             | +~3–5 KB      | +~3–5 KB      | [x]  |
| 16  | React Migration (React)                             | 4/5        | Medium    | Very High | 0             | +~100–130 KB  | +~100–130 KB  | [ ]  |
| 17  | Batch Processing                                    | 4/5        | Very High | Very High | 0             | +~11–15.5 KB  | +~11–15.5 KB  | [ ]  |
| 18  | Raise File Size Limits                              | 4.5/5      | Low       | Very High | 0‡            | +~0.1–0.2 KB  | +~0.1–0.2 KB  | [ ]  |
| 19  | Worker Pool (Parallel Batch)                        | 4.5/5      | High      | Very High | 0             | +~1.4–2.4 KB  | +~1.4–2.4 KB  | [ ]  |

† PWA service worker and icons load separately and are not in the critical JS bundle.
‡ Near-zero for threshold changes; tiled processing would add +28–70 KB WASM gzipped.

### Bundle Size Watch List

Features that deserve careful size scrutiny before shipping:

| Feature                            | Risk                                     | Mitigation                                                              |
| ---------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| **SVG Rasterization** (#7)         | Doubles WASM binary                      | Lazy-load a separate `svg-converter.wasm` only when user uploads SVG    |
| **Tier 2 Formats — TIFF** (#4)     | +60–90 KB WASM                           | Add TIFF last; evaluate actual size delta after `wasm-opt`              |
| **Parameterized Processing** (#10) | +32–53 KB WASM; `serde_json` hidden cost | Pass ops as `JsValue` array instead of JSON string to skip `serde_json` |
| **Image Watermarking** (#14)       | Wide range due to font + `imageproc`     | Inline `draw_text_mut`, serve font as separate fetch                    |
| **React Migration** (#16)          | +100 KB JS if React chosen               | Use Preact — same API, 1/30th the size                                  |
| **Batch Processing** (#17)         | `fflate` adds ~10 KB                     | Dynamic `import('fflate')` on first ZIP click — deferred cost           |

### Recommended First Sprint (Highest ROI)

If time is limited, these four features deliver the most user value per hour of effort:

1. **Paste from Clipboard** (1.5/5) — Instant workflow improvement, ~4 hours
2. **JPEG Quality Slider** (2/5) — Top user request for any image tool, ~1 day
3. **Compression Benchmark** (2.5/5) — Unique feature, drives engagement, ~2 days
4. **Simple Image Transforms** (2/5) — Flip/rotate alone covers 80% of use cases, ~1.5 days
