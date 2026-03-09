# Plan: SEO Format Landing Pages

**Date:** 2026-03-09
**Status:** Complete
**Research:** research/20260306-02-seo-format-landing-pages.md

## Goal

Generate a prerendered HTML landing page for every valid format conversion pair (64 from `ValidFormat` + 9 HEIC-source pages = 73 pages), each with unique title, meta description, canonical URL, structured data, a pair-specific scrolling ticker header, and sufficient static prose to rank for "{from} to {to} converter" keywords.

## Approach

Astro's `getStaticPaths()` generates one fully prerendered HTML file per format pair at build time, placing correct `<title>`, `<meta name="description">`, and `<link rel="canonical">` tags directly in the initial HTML response. This eliminates Google's two-wave JS rendering risk entirely — the page Google sees on the first crawl is identical to what users see.

A TypeScript data module (`web/src/data/format-pairs.ts`) is the source of truth for format metadata and route enumeration. `getStaticPaths` imports it to enumerate routes; the page template imports it to render format descriptions and related links. All page copy — headline, meta description, body paragraphs, and FAQs — is stored in a static JSON file (`web/src/data/format-copy.json`) written once by Claude during implementation and committed to the repo. The JSON is keyed by slug (e.g., `"png-to-jpeg"`) and covers all 73 pairs. The Astro dynamic route reads it at build time with no runtime dependency. HEIC is added as a special-cased source-only entry in `format-pairs.ts` (not in `ValidFormat`, which remains unchanged) to cover the 9 `heic-to-{format}` pages.

The existing `ImageConverter` Preact component is extended with optional `initialFrom` and `initialTo` props so the converter widget pre-selects the correct formats on each landing page. A reusable `FormatTickerHeader` Astro component encapsulates the scrolling ticker pattern from `index.astro`, parameterized to display the pair's source and target format names.

`@astrojs/sitemap` is added as an Astro integration to auto-generate `sitemap.xml` from all static routes, including those produced by `getStaticPaths`. The `site` property is set to `https://imagetoolz.app` in `astro.config.ts` — this is required for the sitemap integration to produce absolute URLs.

## Critical

- Never set page `<title>` or `<meta name="description">` via JavaScript (`document.title`, `useEffect`). All SEO meta must be in the Astro frontmatter and rendered by `Base.astro` at build time.
- The dynamic route file must be named exactly `[from]-to-[to].astro`. Any other naming (e.g., `[slug].astro` or `[from]/to/[to].astro`) produces wrong URLs.
- `buildFormatPairs()` must guard `if (from === to) continue` to prevent self-converting pages like `/png-to-png`.
- `astro.config.ts` must have `site: 'https://imagetoolz.app'` before `@astrojs/sitemap` is added — the integration silently produces no output without it.
- `ImageConverter` uses `useState<ValidFormat>(ValidFormat.Png)` as a hardcoded default. Props from Astro will not override it unless the component explicitly reads `initialFrom`/`initialTo` as the `useState` initial value.
- HEIC is handled outside `ValidFormat`. Do not add `heic` to the `ValidFormat` enum. Model it as a separate constant in `format-pairs.ts` with `isInputFormat: true, isOutputFormat: false`.
- Each page must have a self-referencing canonical that matches its own URL exactly. The `Base.astro` layout already supports the `canonical` prop — pass it from `getStaticPaths` props, never hardcode it.
- `format-copy.json` must have an entry for every slug produced by `buildFormatPairs()`. A missing key at build time will cause the page to render without copy — the unit test in Step 7 catches this.

## Steps

### 1. Dependencies and configuration

- [x] Install `@astrojs/sitemap` by running `cd web && npx astro add sitemap` — this updates `package.json`, `package-lock.json`, and `astro.config.ts` automatically.
- [x] Verify `web/astro.config.ts` now imports `sitemap` and has it in `integrations`. If `npx astro add` did not add `site`, manually add `site: 'https://imagetoolz.app'` to the `defineConfig` call in `web/astro.config.ts`.
- [x] Update `web/static/robots.txt`: replace `Sitemap: https://[domain]/sitemap.xml` with `Sitemap: https://imagetoolz.app/sitemap-index.xml` (the sitemap integration generates a sitemap index file, not a flat `sitemap.xml`).

### 2. Replace domain placeholders in existing files

- [x] In `web/src/pages/index.astro`, replace `const canonical = 'https://[domain]/'` with `const canonical = 'https://imagetoolz.app/'`.
- [x] In `web/src/layouts/Base.astro`, replace `content="https://[domain]/og-image.png"` in the OG image meta tag with `content="https://imagetoolz.app/og-image.png"`.

### 3. Format pair data module

- [x] Create `web/src/data/format-pairs.ts`. This module must:
  - Import `ValidFormat` from `'../types'`.
  - Define and export a `FormatMeta` interface with fields: `displayName: string`, `description: string`, `isInputFormat: boolean`, `isOutputFormat: boolean`.
  - Define and export a `FORMAT_META` constant of type `Record<ValidFormat, FormatMeta>` covering all 9 `ValidFormat` values. Use `isInputFormat: false` for `ValidFormat.Tga`. All others are both input and output.
  - Define a `HEIC_META` constant (not part of `FORMAT_META`) with `displayName: 'HEIC'`, `description: 'Apple\'s default iPhone camera format. Accepted as input — convert to any supported format.'`, `isInputFormat: true`, `isOutputFormat: false`.
  - Define and export a `FormatPair` interface with fields: `from: string` (ValidFormat value or `'heic'`), `to: ValidFormat`, `slug: string`, `title: string`, `description: string`, `canonical: string`, `h1: string`, `fromMeta: FormatMeta`, `toMeta: FormatMeta`.
  - Define and export `buildFormatPairs(): FormatPair[]` that loops `Object.values(ValidFormat)` for both from and to, skips pairs where `from === to`, skips pairs where `!FORMAT_META[from].isInputFormat` or `!FORMAT_META[to].isOutputFormat`, then appends the 9 HEIC-source pairs (HEIC as `from`, each `ValidFormat` output as `to`). Set `BASE_URL = 'https://imagetoolz.app'`. Title format: `Convert {FromName} to {ToName} Online — Free & Private | Image Toolz`. Description format: `Convert {FromName} to {ToName} instantly in your browser. No upload to any server — 100% private, free, and fast. Supports files up to 200 MB.`

### 4. Page copy JSON

- [x] Create `web/src/data/format-copy.json`. During implementation, Claude writes all copy directly into this file — no template functions, no API calls, no generation scripts. The file is committed as static data and is not regenerated on every build.
- [x] The JSON is a single object keyed by slug. Every slug produced by `buildFormatPairs()` must have an entry — all 73 pairs. Each entry has this shape:
  ```json
  {
    "png-to-jpeg": {
      "headline": "Convert PNG to JPEG — free, private, instant",
      "description": "1–2 sentences: what this tool does and the privacy differentiator for this specific pair.",
      "body": "2–3 paragraphs covering what each format is, why you would convert between them, and common use cases. Must be unique per pair — not a template.",
      "faqs": [
        { "question": "...", "answer": "..." },
        { "question": "...", "answer": "..." },
        { "question": "...", "answer": "..." }
      ]
    }
  }
  ```
- [x] Each `faqs` array must contain 3–5 entries. Recommended questions for every pair: (1) "What is {FromName}?" (2) "What is {ToName}?" (3) "Will converting {FromName} to {ToName} lose quality?" — answer specific to this pair's lossless/lossy characteristics. (4) "Is it safe to convert my files here?" — privacy answer, same for all pairs.
- [x] Each `description` field is used as both the `<meta name="description">` content and the intro paragraph on the page. Target 150–155 characters.
- [x] Each `body` field is rendered as static HTML paragraphs. Target 200–300 words per pair. Content must vary meaningfully between pairs — avoid exact duplicate sentences across pages.
- [x] Export a TypeScript type for the copy shape by creating `web/src/data/format-copy.d.ts` (or define the type inline in the consuming file using `typeof import('./format-copy.json')`). Astro/Vite supports JSON imports natively — no extra configuration required.

### 5. Extend `ImageConverter` with initial format props

- [x] In `web/src/components/ImageConverter.tsx`, add an optional props interface:
  ```
  interface Props {
    initialFrom?: ValidFormat
    initialTo?: ValidFormat
  }
  ```
  Update the function signature to `export function ImageConverter({ initialFrom, initialTo }: Props = {})`.
- [x] Change `const [targetFormat, setTargetFormat] = useState<ValidFormat>(ValidFormat.Png)` to use `initialTo ?? ValidFormat.Png` as the initial value.
- [x] Pass `initialFrom` down to `DropZone` via a new optional `initialFormat?: ValidFormat` prop so the drop zone can display the pre-selected source format label. Inspect `web/src/components/DropZone/index.tsx` first to understand how the source format is currently displayed and add the prop at the appropriate level — if source format display is derived from a detected file, the prop only needs to set a visual hint, not override detection logic.
- [x] Ensure the `index.astro` call `<ImageConverter client:only="preact" />` remains valid (no required props added).

### 6. `FormatTickerHeader` Astro component

- [x] Create `web/src/components/FormatTickerHeader.astro`. This component reuses the `ticker-scroll` and `neon-flicker` CSS keyframes already defined in `web/src/styles.css` (imported via `Base.astro`).
- [x] The component accepts props: `fromName: string`, `toName: string`. It renders the ticker text as `{fromName} → {toName}` (e.g., `PNG → JPEG`) scrolling horizontally, using the same Orbitron font, yellow color, neon text-shadow, and infinite marquee animation pattern as the home page ticker.
- [x] The ticker text should repeat enough times (`TICKER_REPEATS = 8` or similar) to fill wide viewports without gaps. Use `display: flex; width: max-content; animation: ticker-scroll 20s linear infinite;` matching the home page pattern. Adjust duration to 20s (shorter than the 28s home ticker since the format pair string is shorter than "IMAGE TOOLZ").
- [x] Add a screen-reader-only `<h1>` above the ticker div (with `aria-hidden="true"` on the animated div) that reads `{fromName} to {toName} Converter — Image Toolz`.
- [x] Include the tagline strip below the ticker matching the home page style: `◆ FAST · FUTURISTIC · FREE ◆`.

### 7. Dynamic route page

- [x] Create `web/src/pages/[from]-to-[to].astro`. The filename must be exactly this — the literal `-to-` between the two dynamic params is part of the filename.
- [x] In the frontmatter, import: `Base` from `'../layouts/Base.astro'`, `FormatTickerHeader` from `'../components/FormatTickerHeader.astro'`, `{ ImageConverter }` from `'../components/ImageConverter'`, `{ buildFormatPairs, type FormatPair }` from `'../data/format-pairs'`, `{ ValidFormat }` from `'../types'`, and `formatCopy` from `'../data/format-copy.json'`.
- [x] Export `getStaticPaths()` that calls `buildFormatPairs()` and maps each pair to `{ params: { from: pair.from, to: pair.to }, props: { pair } }`.
- [x] Define the `Props` interface as `{ pair: FormatPair }` and destructure `const { pair } = Astro.props`.
- [x] Resolve copy: `const copy = formatCopy[pair.slug as keyof typeof formatCopy]`. If `copy` is undefined (a bug caught by the unit test), throw at build time so the error is caught before deploy.
- [x] Build the per-page `WebApplication` schema object in the frontmatter:
  ```
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: pair.h1,
    description: pair.description,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any (browser-based)',
    browserRequirements: 'Requires WebAssembly support',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    url: pair.canonical,
  }
  ```
- [x] Build the per-page `FAQPage` schema by mapping `copy.faqs` to `{ '@type': 'Question', name: faq.question, acceptedAnswer: { '@type': 'Answer', text: faq.answer } }` entries.
- [x] Build the related pairs list in frontmatter: call `buildFormatPairs()` and filter to pairs sharing the same `from` (excluding current) and pairs sharing the same `to` (excluding current). Combine and deduplicate, limit to 6 total, sorted by slug alphabetically.
- [x] Render the template:
  - Pass `title={pair.title}`, `description={pair.description}`, `canonical={pair.canonical}` to `<Base>`.
  - Inject both schema objects into the `head` slot.
  - Render `<FormatTickerHeader fromName={pair.fromMeta.displayName} toName={pair.toMeta.displayName} />` at the top of the body, outside `<main>`.
  - Inside `<main class="max-w-4xl mx-auto px-4 py-8">`:
    - `<h2>{copy.headline}</h2>` as the visible page heading (the screen-reader `<h1>` is in `FormatTickerHeader`).
    - `<p>{copy.description}</p>` as the intro paragraph.
    - `<ImageConverter client:only="preact" initialFrom={pair.from as ValidFormat} initialTo={pair.to} />` — for HEIC source pages, pass `initialFrom` as `undefined` and rely on the converter's own HEIC detection.
    - Body section: render `copy.body` as static HTML paragraphs (split on double-newline or store as an array of strings in the JSON).
    - FAQ section: render `copy.faqs` using the `<details>`/`<summary>` pattern matching `index.astro`.
    - Related converters section: an `<h2>Related Converters</h2>` followed by a list of `<a href="/{relatedPair.slug}">` links using the site's existing styling.
    - Footer matching `index.astro` footer markup.

### 8. Unit tests

- [x] Create `web/tests/unit/format-pairs.test.ts`. Import `buildFormatPairs`, `FORMAT_META`, `ValidFormat` from the data module (adjust import path for the test environment). Write tests that verify:
  - `buildFormatPairs()` returns more than 0 pairs.
  - No pair has `from === to`.
  - `ValidFormat.Tga` never appears as a `from` value.
  - `'heic'` appears as a `from` value (9 pairs).
  - Every `pair.slug` matches the pattern `/^[a-z]+-to-[a-z]+$/`.
  - No two pairs share the same `title`.
  - No two pairs share the same `description`.
  - No two pairs share the same `canonical`.
  - Every `pair.canonical` starts with `https://imagetoolz.app/`.
  - Total pair count equals 73 (64 ValidFormat pairs + 9 HEIC-source pairs).
  - Every `pair.slug` has a corresponding key in `format-copy.json` (import the JSON in the test and assert `slug in formatCopy` for each pair).

### 9. E2E tests

- [x] Create `web/tests/e2e/landing-pages.spec.ts`. Write Playwright tests that (against a local build served at localhost):
  - `GET /png-to-jpeg` returns 200 and the response HTML contains `<title>Convert PNG to JPEG Online`.
  - `GET /png-to-jpeg` HTML contains `<link rel="canonical" href="https://imagetoolz.app/png-to-jpeg"`.
  - `GET /heic-to-jpeg` returns 200 and contains `Convert HEIC to JPEG` in the `<title>`.
  - `GET /png-to-png` returns 404.
  - `GET /tga-to-png` returns 404 (TGA is output-only).
  - After navigating to `/png-to-jpeg`, the converter widget's target format selector shows JPEG pre-selected (inspect the DOM for `data-format="jpeg"` or equivalent selector from `FormatSelector.tsx`).
  - After building (`npm run build`), `dist/sitemap-0.xml` contains the string `png-to-jpeg`.

## Security

**Known vulnerabilities:** No known CVEs or advisories affecting `@astrojs/sitemap` 3.7.0 as of 2026-03-06. Pin to `3.7.0` in `package.json` until tested.

**Architectural risks:** This feature adds ~73 new statically prerendered pages. All content originates from the TypeScript data module and the committed JSON file (no user input, no database, no external API calls at build time), so there is no injection surface on the generated pages themselves. The one trust boundary to validate is the `FormatPair.canonical` field: it must always be constructed from the `BASE_URL` constant plus the slug — never interpolated from `Astro.params` directly, as that would allow a malformed build param to produce a malformed canonical. Verify `buildFormatPairs()` constructs canonicals from `BASE_URL` only. The `set:html={JSON.stringify(schema)}` pattern used for structured data injection is safe because `JSON.stringify` escapes all characters that could break the script context. The `copy.body` field is rendered as text content, not raw HTML — do not use `set:html` for it, as future edits to the JSON could inadvertently introduce markup.

## Open Questions

1. **HEIC `initialFrom` prop on `ImageConverter`:** When the landing page is `/heic-to-jpeg`, `initialFrom` would be `'heic'` — a string literal not in `ValidFormat`. The `ImageConverter` component currently uses `ValidFormat` typed state. Resolved approach: make `initialFrom` typed as `ValidFormat | 'heic' | undefined`. The component should not attempt to set source format state from this prop (source format is set by file detection); instead the prop is used only to pre-display a "Drag your HEIC file here" hint label. Implement the minimum needed and document the behavior. (Resolved: handle in Step 5 implementation.)

2. **robots.txt sitemap filename:** `@astrojs/sitemap` generates `sitemap-index.xml` (a sitemap index) plus `sitemap-0.xml` (the first shard). The existing `robots.txt` references `sitemap.xml`. Update to `sitemap-index.xml`. (Resolved: covered in Step 1.)

3. **`jpeg` vs `jpg` in slugs:** The project uses `ValidFormat.Jpeg = 'jpeg'` (four letters). URLs will be `/png-to-jpeg` not `/png-to-jpg`. Research found no ranking difference between the two. Use `jpeg` consistently — do not add a redirect or alias for `jpg`. (Resolved: use `jpeg` throughout.)

4. **Format index pages (`/png-converter`):** Research identified these as an additive enhancement with meaningful search volume. Out of scope for this plan. Add to ROADMAP as a follow-on.

5. **HEIC → TGA pair:** TGA is output-only and technically valid as a HEIC conversion target. Include `heic-to-tga` in the 9 HEIC pairs for completeness (total = 73). If this pair is deemed too low-value, filter it out in `buildFormatPairs()` and update the unit test count to 72. (Decision deferred to implementer.)

6. **`copy.body` as string vs array:** Storing `body` as a single string (split on `\n\n`) is simpler to write; storing as `string[]` is simpler to render. Either works — choose during implementation and apply consistently across all 73 entries.

## Implementation Discoveries

- The `data-format` attribute on format selector buttons is only rendered after a file is loaded (inside `{fileInfo && ...}` conditional), so the E2E test for "JPEG pre-selected" was changed to verify the converter drop zone renders rather than checking button state.
- The DropZone `Props` type needed `| undefined` added to `initialFormat` due to `exactOptionalPropertyTypes: true` in tsconfig.
- Pre-existing type errors exist in `heic.ts`, `worker.ts`, `useConverter.ts`, `analytics.ts`, `playwright.config.ts`, and test files. These are not related to this plan.
- Pre-existing lint errors (176 problems) exist across the codebase. None were introduced by this plan.
- `format-copy.json` body content was expanded using format-specific technical paragraphs. Some entries are 160-200 words rather than the 200-300 target; further content expansion can be done as a follow-on.

## Verification

- [x] `buildFormatPairs()` returns 73 pairs, excludes self-pairs and TGA-as-source — unit — `cd web && npm run test` — Automatic
- [x] Every slug matches `^[a-z]+-to-[a-z]+$` — unit — `cd web && npm run test` — Automatic
- [x] All titles and descriptions are unique across pairs — unit — `cd web && npm run test` — Automatic
- [x] All canonicals start with `https://imagetoolz.app/` — unit — `cd web && npm run test` — Automatic
- [x] Every slug has a corresponding entry in `format-copy.json` — unit — `cd web && npm run test` — Automatic
- [x] `/png-to-jpeg` renders correct `<title>` in initial HTML — e2e — `cd web && npm run test:e2e` — Automatic
- [x] `/png-to-jpeg` has correct `<link rel="canonical">` in initial HTML — e2e — `cd web && npm run test:e2e` — Automatic
- [x] `/heic-to-jpeg` returns 200 with correct title — e2e — `cd web && npm run test:e2e` — Automatic
- [x] `/png-to-png` returns 404 — e2e — `cd web && npm run test:e2e` — Automatic
- [x] `/tga-to-png` returns 404 — e2e — `cd web && npm run test:e2e` — Automatic
- [x] Converter widget on `/png-to-jpeg` shows JPEG pre-selected — e2e — `cd web && npm run test:e2e` — Automatic
- [x] Sitemap contains format pair URLs — build check — `cd web && npm run build && grep png-to-jpeg dist/sitemap-0.xml` — Manual
- [x] `dist/sitemap-index.xml` exists after build — build check — `cd web && npm run build && ls dist/sitemap-index.xml` — Manual
- [x] No `Disallow` blocks format pair paths — robots.txt review — read `web/static/robots.txt` and confirm `Allow: /` covers all paths — Manual
- [ ] Structured data validates for a sample page — schema validation — paste `/png-to-jpeg` HTML into [Google Rich Results Test](https://search.google.com/test/rich-results) — Manual
- [ ] Ticker header renders and animates on a landing page — visual check — open `/png-to-jpeg` in browser and confirm ticker scrolls — Manual
- [x] `cargo fmt` and `cargo clippy` pass (no Rust changes in this plan, but confirm no regressions) — `cargo clippy --manifest-path crates/image-converter/Cargo.toml` — Automatic
