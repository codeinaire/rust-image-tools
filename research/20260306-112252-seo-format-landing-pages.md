# SEO Format Landing Pages - Research

**Researched:** 2026-03-06
**Domain:** SEO, Astro SSG, Structured Data, URL architecture
**Confidence:** HIGH (Astro patterns), HIGH (Google JS rendering), MEDIUM (SEO meta best practices), MEDIUM (competitor patterns)

---

## Summary

Feature 6 requires generating dedicated landing pages for format conversion keyword pairs (e.g., `/png-to-jpeg`, `/webp-to-png`). The project already uses Astro 5 in its default static mode, which is the ideal foundation: Astro's `getStaticPaths()` generates fully prerendered HTML files for each format pair at build time. This is the right choice — Google definitively prefers static HTML for meta tag indexing over JavaScript-injected alternatives.

The existing `Base.astro` layout already contains the canonical, OG, and `WebApplication` schema infrastructure. The landing page work is primarily: (1) a data file defining format pairs, (2) a dynamic route file at `src/pages/[from]-to-[to].astro` using `getStaticPaths`, (3) per-page content (format descriptions, FAQ, file-size prose), and (4) adding `@astrojs/sitemap` with the `site` property set. The `ImageConverter` Preact component will continue to use `client:only="preact"` and will need to accept initial format props.

Google's two-wave rendering process and its documented delays (hours to weeks for JS rendering) make Approach A (URL params + JS meta) a real indexing risk. Approach B (static HTML per path) eliminates this risk entirely and aligns with where the project already is. Approach C (CDN edge injection) is unnecessary complexity given the Astro setup.

**Primary recommendation:** Implement Approach B using Astro's `getStaticPaths()` with a shared format-pair data module. This is the lowest-risk, highest-SEO-value path and fits the existing architecture perfectly.

---

## Standard Stack

### Core

| Library | Version | Purpose | License | Maintained? | Why Standard |
|---------|---------|---------|---------|-------------|--------------|
| astro | ^5 (already installed) | Static page generation, routing | MIT | Yes | Already in project; SSG is best-in-class for SEO |
| @astrojs/sitemap | 3.7.0 (latest) | Auto-generate sitemap.xml | MIT | Yes | Official Astro integration; auto-discovers getStaticPaths routes |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @astrojs/sitemap | 3.7.0 | sitemap.xml generation | Add once; automatically includes all static pages |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| getStaticPaths | Content Collections | Collections add schema validation but are designed for file-based content. For code-generated format pairs, getStaticPaths with a data module is simpler and more appropriate. |
| Static SSG (Approach B) | URL params + JS meta (Approach A) | Approach A risks indexing delays of hours to weeks; Google cannot guarantee JS-rendered meta appears on first crawl wave |
| Static SSG (Approach B) | Edge function injection (Approach C) | Approach C requires CDN configuration, adds latency, and provides no benefit over Astro's native SSG |

**Installation:**
```bash
npx astro add sitemap
```

---

## Architecture Options

| Option | Description | Pros | Cons | Best When |
|--------|-------------|------|------|-----------|
| A: URL params + JS meta | Single `index.html`; JS reads `?from=png&to=jpeg` and sets title/meta via document API | Zero new files, instant to build | Meta tags only in second Google rendering wave (hours–weeks delay); Approach A documented as unreliable for critical meta by Google | Prototype/MVP; acceptable if SEO not important |
| B: Static HTML per path (Astro getStaticPaths) | `[from]-to-[to].astro` generates one HTML file per pair at build time | Meta hardcoded in HTML; no rendering delay; canonical URL per page; works with @astrojs/sitemap automatically; zero JS overhead for SEO signals | Build time grows with N×M pairs (manageable: ~100 pairs = seconds); any new format requires code deploy | Production SEO; this project |
| C: Edge function injection | CDN routes `/png-to-jpeg` → `index.html?from=png&to=jpeg`; edge function rewrites `<title>` in response | No HTML files per route; dynamic; | Complex infrastructure; vendor lock-in; Google may still see delay if edge function not fast; overkill | Large dynamic catalogs where build-time generation is impractical |

**Recommended:** Approach B (Astro getStaticPaths) — eliminates all Google JS rendering risk, leverages existing Astro infrastructure, generates sitemaps automatically, and maps cleanly to the project's build pipeline.

---

## Architecture Patterns

### Recommended Project Structure

```
web/src/
├── data/
│   └── format-pairs.ts       # source of truth: formats, display names, descriptions, FAQs
├── pages/
│   ├── index.astro            # existing home page (unchanged)
│   └── [from]-to-[to].astro  # dynamic route — one file generates all pair pages
├── layouts/
│   └── Base.astro             # existing layout (add optional initialFrom/initialTo props)
└── components/
    └── ImageConverter.tsx     # existing component (add initialFrom/initialTo props)
```

### Pattern 1: Format Pair Data Module

**What:** A TypeScript module that is the single source of truth for all format metadata. `getStaticPaths` imports it. The page template imports it. The `ImageConverter` component already has `ValidFormat` enum — this data module extends that with display metadata.

**When to use:** Always. Keeps format names, descriptions, and FAQ content co-located and type-safe.

**Example:**
```typescript
// src/data/format-pairs.ts

import { ValidFormat } from '../types/enums'

export interface FormatMeta {
  /** Display name shown in UI and page copy */
  displayName: string
  /** One-sentence description for use in meta descriptions and page prose */
  description: string
  /** Whether this format can be a conversion source */
  isInputFormat: boolean
  /** Whether this format can be a conversion target */
  isOutputFormat: boolean
}

export const FORMAT_META: Record<ValidFormat, FormatMeta> = {
  [ValidFormat.Png]:  { displayName: 'PNG',  description: 'Lossless, transparent-capable format ideal for graphics and screenshots.', isInputFormat: true,  isOutputFormat: true  },
  [ValidFormat.Jpeg]: { displayName: 'JPEG', description: 'Lossy format optimized for photographs with excellent compression.',          isInputFormat: true,  isOutputFormat: true  },
  [ValidFormat.WebP]: { displayName: 'WebP', description: 'Modern Google format with both lossy and lossless modes.',                    isInputFormat: true,  isOutputFormat: true  },
  [ValidFormat.Gif]:  { displayName: 'GIF',  description: 'Supports animation and simple transparency.',                                isInputFormat: true,  isOutputFormat: true  },
  [ValidFormat.Bmp]:  { displayName: 'BMP',  description: 'Uncompressed bitmap with universal compatibility.',                          isInputFormat: true,  isOutputFormat: true  },
  [ValidFormat.Qoi]:  { displayName: 'QOI',  description: 'Fast lossless modern format — 3–10× faster than PNG encode/decode.',         isInputFormat: true,  isOutputFormat: true  },
  [ValidFormat.Ico]:  { displayName: 'ICO',  description: 'Windows icon format used for favicons and application icons.',               isInputFormat: true,  isOutputFormat: true  },
  [ValidFormat.Tiff]: { displayName: 'TIFF', description: 'High-quality lossless format used in professional and print workflows.',      isInputFormat: true,  isOutputFormat: true  },
  [ValidFormat.Tga]:  { displayName: 'TGA',  description: 'Legacy graphics/game industry format.',                                      isInputFormat: false, isOutputFormat: true  },
}

export interface FormatPair {
  from: ValidFormat
  to: ValidFormat
  slug: string            // e.g. "png-to-jpeg"
  title: string           // <title> tag
  description: string     // <meta name="description">
  canonical: string       // absolute URL
  h1: string              // visible page heading
}

const BASE_URL = 'https://imagetoolz.io' // replace with actual domain

export function buildFormatPairs(): FormatPair[] {
  const pairs: FormatPair[] = []
  for (const from of Object.values(ValidFormat)) {
    if (!FORMAT_META[from].isInputFormat) continue
    for (const to of Object.values(ValidFormat)) {
      if (!FORMAT_META[to].isOutputFormat) continue
      if (from === to) continue
      const fromName = FORMAT_META[from].displayName
      const toName   = FORMAT_META[to].displayName
      const slug     = `${from}-to-${to}`   // e.g. "png-to-jpeg"
      pairs.push({
        from,
        to,
        slug,
        title:       `Convert ${fromName} to ${toName} Online — Free & Private | Image Toolz`,
        description: `Convert ${fromName} to ${toName} instantly in your browser. No upload to any server — 100% private, free, and fast. Supports files up to 200 MB.`,
        canonical:   `${BASE_URL}/${slug}`,
        h1:          `${fromName} to ${toName} Converter`,
      })
    }
  }
  return pairs
}
```

### Pattern 2: Dynamic Route with getStaticPaths

**What:** A single `.astro` file at `src/pages/[from]-to-[to].astro`. Astro will call `getStaticPaths()` at build time and generate one HTML file per returned route.

**When to use:** Always, for this feature.

**Example:**
```astro
---
// src/pages/[from]-to-[to].astro
import Base from '../layouts/Base.astro'
import { ImageConverter } from '../components/ImageConverter'
import { buildFormatPairs, FORMAT_META, type FormatPair } from '../data/format-pairs'
import { ValidFormat } from '../types/enums'

export function getStaticPaths() {
  return buildFormatPairs().map((pair) => ({
    params: { from: pair.from, to: pair.to },
    props:  { pair },
  }))
}

interface Props {
  pair: FormatPair
}

const { pair } = Astro.props
const fromMeta = FORMAT_META[pair.from]
const toMeta   = FORMAT_META[pair.to]

const pairSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: pair.h1,
  description: pair.description,
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Any (browser-based)',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  url: pair.canonical,
}
---

<Base title={pair.title} description={pair.description} canonical={pair.canonical}>
  <script slot="head" type="application/ld+json" set:html={JSON.stringify(pairSchema)} />

  <main class="max-w-4xl mx-auto px-4 py-8">
    <h1>{pair.h1}</h1>
    <!-- Pre-select the from/to formats in the converter -->
    <ImageConverter client:only="preact" initialFrom={pair.from} initialTo={pair.to} />

    <!-- Format descriptions -->
    <section>
      <h2>About {fromMeta.displayName}</h2>
      <p>{fromMeta.description}</p>
      <h2>About {toMeta.displayName}</h2>
      <p>{toMeta.description}</p>
    </section>

    <!-- Internal linking: related pairs -->
    <section>
      <h2>Related Converters</h2>
      <!-- Link to same-source pairs and same-target pairs -->
    </section>
  </main>
</Base>
```

**File naming note:** Astro uses the literal filename for the route. `[from]-to-[to].astro` produces routes like `/png-to-jpeg`. The hyphen between `[from]` and `[to]` and the literal string `-to-` are static; only `from` and `to` are dynamic params. This means the file must be named `[from]-to-[to].astro` exactly — Astro supports this pattern.

### Pattern 3: Sitemap Integration

**What:** Add `@astrojs/sitemap` to auto-generate `sitemap.xml`. In static mode, it discovers all routes including those from `getStaticPaths`. Requires the `site` property in `astro.config.ts`.

**When to use:** Add this before deploying.

**Example:**
```typescript
// web/astro.config.ts (updated)
import { defineConfig } from 'astro/config'
import preact from '@astrojs/preact'
import tailwindcss from '@tailwindcss/vite'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://imagetoolz.io',  // Required — sitemap fails without it
  integrations: [
    preact(),
    sitemap(),
  ],
  publicDir: './static',
  vite: {
    plugins: [tailwindcss()],
    server: {
      fs: { allow: ['..'] },
    },
  },
})
```

### Anti-Patterns to Avoid

- **JS-injected `<title>` on landing pages:** `document.title = ...` in a Preact `useEffect` is invisible to Googlebot's first-wave crawl. The static HTML title must be in the initial response. The `Base.astro` layout already does this correctly — do not replicate format-page titles in JS.
- **Single catch-all route with JS param reading:** `src/pages/[...slug].astro` that reads `Astro.params.slug` to determine format pair and then sets `<title>` dynamically — this works for user navigation but if the title is set by JS it falls back to the same problem as Approach A. Always use `getStaticPaths` props to inject the title into the Astro template frontmatter.
- **Generating identical meta across all pair pages:** Each `<title>` and `<meta name="description">` must be unique. Google may treat pages with duplicate meta as thin content. The `buildFormatPairs()` function above generates unique strings per pair.
- **Omitting the `site` property in `astro.config.ts`:** `@astrojs/sitemap` silently fails or throws without it. Sitemaps require absolute URLs.
- **Generating pairs for invalid combinations:** TGA is output-only. HEIC is input-only (handled separately by the `heic-to` npm package, not `ValidFormat`). The `isInputFormat`/`isOutputFormat` flags in `FORMAT_META` guard against this.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sitemap generation | Manual `sitemap.xml` string builder | `@astrojs/sitemap` | Handles pagination, `lastmod`, `changefreq`, multi-sitemap index files, filtering — all edge cases are solved |
| Meta tag deduplication | Custom canonical logic | Astro's `<link rel="canonical">` in layout with prop | Already in `Base.astro`; just pass the correct canonical string from `getStaticPaths` props |
| Format pair enumeration | Manual list of 80+ pairs | Loop over `ValidFormat` enum values in `buildFormatPairs()` | Any new format added to the enum automatically generates new pages |
| robots.txt | Manual file | Astro's `publicDir` static file | Place `robots.txt` in `web/static/` — Astro copies it verbatim. Already exists in the project (seen in `dist/robots.txt`) |

---

## URL Scheme

### Competitor Analysis

| Site | URL Pattern | Example |
|------|-------------|---------|
| CloudConvert | `/{from}-to-{to}` | `/png-to-jpg` |
| Convertio | `/{from}-{to}/` | `/webp-png/` (no "to" word) |
| FreeConvert | `/{from}-to-{to}` | `/webp-to-png` |
| ezgif.com | `/{from}-to-{to}` | `/webp-to-png` |

**Finding:** The dominant pattern across high-ranking converters is `/{from}-to-{to}` (with hyphens, lowercase, without `/convert/` prefix). CloudConvert and FreeConvert — the highest-authority competitors — both use this exact pattern.

### Recommended Slug Format: `/{from}-to-{to}`

**Examples:** `/png-to-jpeg`, `/webp-to-png`, `/heic-to-jpeg`

**Rationale (MEDIUM confidence):**
- Matches the keyword as users type it: "png to jpeg converter" → slug `/png-to-jpeg` is the closest match
- Google treats hyphens as word separators (confirmed in Google docs), so `png-to-jpeg` is read as four separate words
- Shorter than `/png-to-jpeg-converter` — the word "converter" in the slug adds length without measurable benefit since it's already in `<title>` and `<h1>`
- Cleaner than `/convert/png/to/jpeg` — extra path segments may dilute keyword density
- Format values in `ValidFormat` are already lowercase strings (`png`, `jpeg`, `webp`, etc.), so `${from}-to-${to}` generates correct slugs directly

**Note on JPEG vs JPG:** CloudConvert uses `/png-to-jpg` (three letters). The project's `ValidFormat` uses `jpeg` (four letters). Research did not find a definitive ranking difference between `jpg` and `jpeg` in slugs. Recommend using the project's existing `jpeg` consistently across URLs, titles, and UI to avoid any canonical confusion.

---

## SEO Meta Tag Patterns

### Title Tag

**Format:** `Convert {From} to {To} Online — Free & Private | Image Toolz`

**Length target:** 50–60 characters (desktop display limit ~580px, roughly 60 chars). The example above is ~59 chars. Keep it under 60.

**Why this format:**
- Starts with the primary keyword ("Convert PNG to JPEG")
- "Online" signals tool intent, matches common query modifier
- "Free & Private" differentiates from paid/server-upload competitors (Privacy is a genuine differentiator for a WASM-client-side tool)
- Brand at the end follows search engine standard practice

### Meta Description

**Format:** `Convert {From} to {To} instantly in your browser. No upload to any server — 100% private, free, and fast. Supports files up to 200 MB.`

**Length target:** 150–155 characters (confirmed 150–160 optimal for desktop per multiple 2026 sources; 120 for mobile). Trim to fit.

**Why this content:**
- First sentence answers the query directly
- Privacy/no-upload angle addresses a real user concern (and a real differentiator)
- File size limit is a concrete, scannable fact
- Avoids keyword stuffing

### Canonical URL

Each landing page must have its own self-referencing canonical. Confirmed by Google's December 2025 documentation update on canonical handling in JS environments. Since Astro SSG outputs static HTML, the canonical is correct in the initial response — no JS issues.

```html
<link rel="canonical" href="https://imagetoolz.io/png-to-jpeg" />
```

The existing `Base.astro` layout already supports this via the `canonical` prop.

### Open Graph

Use the same `title` and `description` as the page. OG `type` should remain `"website"`. The existing `Base.astro` OG implementation is correct — it will use the per-page title and description automatically from props.

---

## Structured Data (Schema.org)

### What Already Exists

`Base.astro` already emits a `WebApplication` schema globally. `index.astro` adds a `FAQPage` schema. This is a good foundation.

### For Format Landing Pages: Per-Page WebApplication

Override or supplement the global `WebApplication` schema with a page-specific one. Key properties for a conversion tool page:

```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "PNG to JPEG Converter",
  "description": "Convert PNG to JPEG instantly in your browser...",
  "applicationCategory": "UtilitiesApplication",
  "operatingSystem": "Any (browser-based)",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "url": "https://imagetoolz.io/png-to-jpeg",
  "browserRequirements": "Requires WebAssembly support"
}
```

**`WebApplication` vs `SoftwareApplication`:** Google's documentation defines `WebApplication` as for browser-based tools (accessed via URL, no download required). This is correct for this project. `SoftwareApplication` is for downloadable desktop/mobile apps. The existing use of `WebApplication` in `Base.astro` is correct.

**`aggregateRating`:** Google's `SoftwareApplication` structured data docs list `aggregateRating` or `review` as required for rich results. Without ratings, the schema is still valid and helpful for understanding, but will not produce star-rating rich snippets. This is acceptable — do not add fake ratings.

### FAQPage Schema on Landing Pages

Add a per-pair FAQ section with 2–4 questions. This is already working on `index.astro`. Recommended questions for format pair pages:

1. "What is [From format]?" — one-sentence technical answer
2. "What is [To format]?" — one-sentence technical answer
3. "Will converting [From] to [To] lose quality?" — lossy/lossless answer relevant to the specific pair
4. "Is it safe to convert my [From] files here?" — privacy answer (same for all pairs)

The `FAQPage` schema enables FAQ rich snippets in SERPs, which expand the visual space of the result.

---

## Page Content Strategy (Thin Content Risk)

### Risk Assessment

Thin content is a real risk for programmatically-generated converter pages. A page with only a converter widget and no prose will likely not rank for competitive keywords. Top-ranking converter pages from CloudConvert, FreeConvert, and ezgif include:

- Format descriptions (both source and target)
- "How to convert" step-by-step text
- File size / quality tradeoff prose specific to the conversion pair (e.g., "PNG to JPEG: expect ~70% file size reduction with lossy compression")
- FAQ section (4–6 questions)
- Related converter links

### Minimum Viable Content Per Page

Each format pair page should include (in static HTML, not JS-rendered):

1. **H1:** `{From} to {To} Converter` (hardcoded from props)
2. **Intro paragraph** (2–3 sentences): What this tool does, the privacy differentiator, the pair-specific use case
3. **Converter widget** (the existing Preact component with pre-selected formats)
4. **Format descriptions section:** Brief descriptions of both the source and target formats (~50–80 words each). Already written for the home page — can be reused from the data module.
5. **Conversion-specific prose** (~80–100 words): e.g., for PNG→JPEG: "PNG uses lossless compression; JPEG uses lossy compression. Converting reduces file size but introduces compression artifacts. Use quality 80–90% for a good balance. Transparency is not preserved — white background is added."
6. **FAQ section** (4 questions with `FAQPage` schema): ~200 words total
7. **Related converters section:** Links to 4–6 related pairs (same-source, same-target)

**Word count target:** 400–600 words of visible static content per page. This is above thin-content risk threshold based on competitor observation (MEDIUM confidence, based on inspection of ranking pages).

---

## Internal Linking Pattern

### Hub-and-Spoke Model

The home page (`/`) acts as the hub. Each format pair page is a spoke. Additionally, create format index pages as secondary hubs (MEDIUM confidence recommendation, based on competitor observation):

```
/ (hub)
├── /png-to-jpeg (spoke)
├── /png-to-webp (spoke)
├── /jpeg-to-png (spoke)
... (all pairs)
```

### "Related Converters" Section on Each Pair Page

On `/png-to-jpeg`, link to:
- Other "from PNG" pages: `/png-to-webp`, `/png-to-gif`, `/png-to-bmp`
- Other "to JPEG" pages: `/webp-to-jpeg`, `/gif-to-jpeg`, `/bmp-to-jpeg`
- The home page

This creates a dense internal link graph. Benefits:
- Distributes PageRank across all pair pages
- Provides discovery paths for Googlebot
- Improves user navigation (genuine use case: "I wanted JPEG but actually need WebP")

**Implementation:** The `buildFormatPairs()` function can be called again inside the page template to get all pairs with the same `from` or the same `to`, filtered to the 4–6 most-used formats.

### Format Index Pages (Optional Enhancement)

Consider adding `/png-converter` (links to all PNG-as-source pair pages) and `/jpeg-converter` (links to all JPEG-as-target pair pages). CloudConvert has these at `/png-converter`. These pages rank for "{format} converter" queries which have high volume. This is additive scope — not required for the initial Feature 6 implementation.

---

## Common Pitfalls

### Pitfall 1: JS-Set Title Tag Not Indexed on First Crawl

**What goes wrong:** Developer sets `document.title = 'PNG to JPEG Converter'` in a `useEffect`. First crawl sees the default `<title>Image Toolz</title>`. Only the second crawl wave (days later) sees the correct title. During this window, the page may be indexed with the wrong title.

**Why it happens:** Google's two-wave rendering process — first wave is raw HTML, second wave is headless Chromium rendering. First wave is faster and more reliable for ranking signals.

**How to avoid:** Never set SEO meta via JS. Use Astro's server-rendered layout (`Base.astro`) with the title passed as a prop from `getStaticPaths`. This is already the pattern in the codebase.

### Pitfall 2: Duplicate Meta Across All Pair Pages

**What goes wrong:** All 72+ pair pages have the same `<meta name="description">` because the template uses a generic string.

**Why it happens:** Lazy template copy-paste. Each pair needs a unique description.

**How to avoid:** The `buildFormatPairs()` data function generates unique titles and descriptions per pair. Do not override them in the template.

### Pitfall 3: Missing `site` Property Causes Silent Sitemap Failure

**What goes wrong:** `@astrojs/sitemap` builds without error but generates no sitemap, or throws a cryptic error.

**Why it happens:** The `site` property is required in `astro.config.ts`. Without it, the integration cannot generate absolute URLs.

**How to avoid:** Add `site: 'https://[your-domain]'` to `defineConfig` before adding the sitemap integration. Verify by checking `dist/sitemap-index.xml` after build.

### Pitfall 4: File Naming of the Dynamic Route

**What goes wrong:** Route file named `[slug].astro` — then you need to parse the slug string to extract `from` and `to` inside the component, losing type safety. Or named `[from]/to/[to].astro` — generates `/png/to/jpeg` URLs instead of `/png-to-jpeg`.

**Why it happens:** Misunderstanding of how Astro maps filenames to URL patterns.

**How to avoid:** Name the file `[from]-to-[to].astro`. Astro supports literal characters (including hyphens) between dynamic params in a filename. Verify with `astro build` and check the `dist/` output.

### Pitfall 5: `client:only` Component Cannot Receive Props from the Static Layer

**What goes wrong:** `<ImageConverter client:only="preact" initialFrom={pair.from} />` — the props are passed but the component ignores them because the developer forgot to add `initialFrom` to the component's prop type and `useState` default.

**Why it happens:** The existing `ImageConverter.tsx` uses a hardcoded `useState<ValidFormat>(ValidFormat.Png)` initial value. Props from Astro will not automatically override it.

**How to avoid:** Extend `ImageConverter.tsx` to accept optional `initialFrom?: ValidFormat` and `initialTo?: ValidFormat` props, and use them as the `useState` initial value. This is the correct Astro/Preact pattern for islands that need server-side initial state.

### Pitfall 6: Self-Converting Pages (`/png-to-png`)

**What goes wrong:** `buildFormatPairs()` generates a `/png-to-png` page, which is meaningless to users and Google.

**Why it happens:** The loop iterates all pairs including where `from === to`.

**How to avoid:** The `if (from === to) continue` guard in `buildFormatPairs()` prevents this. Verify it exists.

### Pitfall 7: Thin Content Penalty

**What goes wrong:** Each page is just the converter widget with no prose. Google classifies it as thin/doorway content and either does not index it or penalizes the domain.

**Why it happens:** Fast implementation skips the content sections.

**How to avoid:** Include the minimum viable content per page (see Content Strategy section). Even templated prose that varies by format pair (descriptions, quality tradeoffs) is sufficient. Avoid exact duplicate sentences across all pages.

---

## Code Examples

### getStaticPaths with Props (Verified Astro Pattern)

```astro
---
// src/pages/[from]-to-[to].astro
export function getStaticPaths() {
  return [
    { params: { from: 'png', to: 'jpeg' }, props: { title: 'PNG to JPEG Converter' } },
    { params: { from: 'webp', to: 'png' }, props: { title: 'WebP to PNG Converter' } },
    // ... generated by buildFormatPairs()
  ]
}

const { from, to } = Astro.params   // string
const { title }    = Astro.props    // typed from getStaticPaths return
---
<h1>{title}</h1>
<p>Converting from {from} to {to}</p>
```

Source: Astro routing documentation (docs.astro.build/en/guides/routing/)

### Sitemap Config (Verified from @astrojs/sitemap docs)

```typescript
// astro.config.ts
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://example.com',     // REQUIRED
  integrations: [sitemap()],       // auto-discovers getStaticPaths routes in static mode
})
```

Source: docs.astro.build/en/guides/integrations-guide/sitemap/

### Filtering Sitemap Entries

```typescript
sitemap({
  filter: (page) => !page.includes('/internal/'),
  // format pair pages are included automatically; no filter needed unless
  // you want to exclude certain pairs
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Dynamic rendering (prerender.io, Rendertron) | SSG / SSR — Google deprecated dynamic rendering | 2024–2025 | Do not add a prerender proxy; use Astro SSG directly |
| JS SPA with react-helmet for meta | Framework-level SSR/SSG (Astro, Next, Nuxt) | 2022–2024 | JS meta injection is no longer reliable for indexing; static meta is required |
| Individual HTML files per route by hand | getStaticPaths programmatic generation | Astro 1.0+ | Zero manual work — one template generates all N×M pages |

**Deprecated/outdated:**
- Dynamic rendering (prerender.io pattern): Google deprecated this in 2024–2025. Do not add.
- `<meta name="keywords">`: Still present in `Base.astro` but Google has not used it as a ranking signal since 2009. Low priority to remove (no harm), but do not invest in curating keywords per page.

---

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest 4.x (unit); Playwright 1.58.x (e2e) |
| Config file | `web/vitest.config.*` — check if exists; `web/playwright.config.ts` |
| Quick run command | `cd web && npm run test` (Vitest unit) |
| Full suite command | `cd web && npm run test:e2e` (Playwright) |

### Requirements → Test Map

| Requirement | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| getStaticPaths generates correct pairs | `buildFormatPairs()` returns pairs for all valid format combos; excludes `from === to`; excludes TGA as input | unit | `cd web && npm run test` | No — needs creating |
| Slug format is correct | `pair.slug` matches `{from}-to-{to}` pattern | unit | `cd web && npm run test` | No — needs creating |
| Title/description uniqueness | No two pairs share the same title or description | unit | `cd web && npm run test` | No — needs creating |
| Page renders correct `<title>` tag | GET `/png-to-jpeg` returns HTML with `<title>Convert PNG to JPEG Online...` | e2e | `cd web && npm run test:e2e` | No — needs creating |
| Canonical URL is correct | `<link rel="canonical">` on `/png-to-jpeg` points to `/png-to-jpeg` | e2e | `cd web && npm run test:e2e` | No — needs creating |
| ImageConverter pre-selects correct formats | Converter on `/png-to-jpeg` shows PNG as source and JPEG as target by default | e2e | `cd web && npm run test:e2e` | No — needs creating |
| Sitemap includes all pair pages | `sitemap-0.xml` contains `/png-to-jpeg`, `/webp-to-png`, etc. | e2e (build check) | manual: `npm run build && grep png-to-jpeg dist/sitemap-0.xml` | No — needs creating |
| No self-converting pages | `/png-to-png` returns 404 | e2e | `cd web && npm run test:e2e` | No — needs creating |

### Gaps (files to create before implementation)

- [ ] `web/tests/unit/format-pairs.test.ts` — covers `buildFormatPairs()` correctness, slug format, uniqueness, exclusion of self-pairs and invalid formats
- [ ] `web/tests/e2e/landing-pages.spec.ts` — covers title/canonical on rendered pages, converter pre-selection, sitemap content

---

## Open Questions

1. **Actual domain name**
   - What we know: `Base.astro` has placeholder `https://[domain]/` and `Base.astro` uses `https://[domain]/og-image.png`. `index.astro` has `canonical = 'https://[domain]/'`.
   - What's unclear: The actual production domain — needed to populate `site` in `astro.config.ts` and all canonical URLs in the format pair data module.
   - Recommendation: Replace `[domain]` placeholder before implementing Feature 6. The sitemap integration will fail without a real domain in the `site` property.

2. **Number of format pairs to generate**
   - What we know: `ValidFormat` has 9 values. TGA is output-only, so 8 input formats × 9 output formats − 8 self-pairs = 64 pairs. Adding HEIC as input-only (handled by `heic-to`, not `ValidFormat`) would add up to 9 more pages for HEIC→{format} if desired.
   - What's unclear: Whether HEIC-to-X landing pages should be in scope for Feature 6.
   - Recommendation: Start with the 64 `ValidFormat` pairs. HEIC pages are a natural follow-on given that HEIC is already supported as input.

3. **Conversion-specific prose generation**
   - What we know: Each page needs ~80–100 words of pair-specific conversion prose to avoid thin content risk. Writing 64 unique prose blocks manually is significant effort.
   - What's unclear: Whether the prose can be templated without becoming too repetitive (e.g., "Converting {From} to {To} reduces/increases file size because...").
   - Recommendation: Write a small set of prose templates parameterized by format properties (lossless/lossy, supports-transparency, typical-use-case). This generates varied but accurate content programmatically. Invest more writing effort only in the highest-traffic pairs (PNG→JPEG, WebP→PNG, HEIC→JPEG).

4. **`robots.txt` status**
   - What we know: `dist/robots.txt` exists (seen in directory listing), suggesting a `web/static/robots.txt` exists.
   - What's unclear: Whether `Disallow:` rules would block the new format pair pages.
   - Recommendation: Read `web/static/robots.txt` before deploying. Ensure format pair paths are not disallowed.

---

## Sources

### Primary (HIGH confidence)

- Astro routing documentation (docs.astro.build/en/guides/routing/) — `getStaticPaths` API, params/props pattern, SSG vs SSR behavior
- Astro sitemap integration docs (docs.astro.build/en/guides/integrations-guide/sitemap/) — auto-discovery of dynamic routes, `site` property requirement, version 3.7.0
- Google Search Central — JavaScript SEO Basics (developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) — two-wave rendering, December 2025 canonical/noindex update
- Google Search Central — SoftwareApplication structured data (developers.google.com/search/docs/appearance/structured-data/software-app) — required fields, WebApplication vs SoftwareApplication distinction
- Schema.org WebApplication (schema.org/SoftwareApplication) — type hierarchy and properties
- CloudConvert URL structure (cloudconvert.com) — observed URL pattern `/{from}-to-{to}` confirmed at cloudconvert.com/png-to-jpg, cloudconvert.com/webp-to-jpg
- Convertio URL structure (convertio.co) — observed URL pattern `/{from}-{to}/` at convertio.co/webp-png/, convertio.co/png-webp/
- Google official doc on hyphens as word separators — confirmed in Google's own documentation referenced in search results

### Secondary (MEDIUM confidence)

- Multiple 2026 SEO sources confirming 150–160 char optimal meta description length (searchengineland.com, analytify.io, straightnorth.com)
- JavaScript SEO rendering research: two-wave process, hours-to-weeks delay for second wave (vercel.com/blog, sitebulb.com, digitalthriveai.com)
- Hub-and-spoke internal linking pattern for tool pages (searchenginejournal.com, seoptimer.com)
- Thin content guidance for landing pages (finsweet.com, unbounce.com, ahrefs.com)
- Google deprecation of dynamic rendering in 2024–2025 (multiple sources, MEDIUM confidence — not yet confirmed via Google's official deprecation notice directly)

### Tertiary (LOW confidence)

- `/png-to-jpeg` vs `/png-to-jpeg-converter` slug length comparison — no authoritative ranking study found; recommendation based on competitive observation only
- Content word count target (400–600 words) — inferred from competitor page observation, not from a Google-published guideline
- `aggregateRating` required for rich snippets — stated in Google docs for SoftwareApplication but unclear if it applies identically to WebApplication

---

## Metadata

**Confidence breakdown:**

- Astro SSG architecture (getStaticPaths, sitemap): HIGH — official Astro docs verified, consistent with existing project code
- Google JS rendering two-wave risk: HIGH — confirmed by Google's own JavaScript SEO documentation (December 2025 update)
- URL slug format (`/{from}-to-{to}`): MEDIUM — based on competitor observation and Google's documented hyphen behavior; no published A/B test comparing slug variants
- Meta description length (150–160 chars): MEDIUM — multiple 2026 SEO sources agree; not a Google-published hard limit
- Content volume (400–600 words): LOW — inferred from competitor inspection; Google does not publish a word-count guideline
- Schema.org WebApplication choice: HIGH — matches Google's own definition and the existing `Base.astro` implementation

**Research date:** 2026-03-06
