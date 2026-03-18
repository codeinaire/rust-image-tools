# SEO Audit & Improvement Recommendations - Research

**Researched:** 2026-03-18
**Domain:** SEO, Technical SEO, Structured Data, Core Web Vitals, Astro SSG
**Confidence:** HIGH (current state analysis), MEDIUM (improvement recommendations)

## Summary

The project has a strong SEO foundation. The Astro SSG architecture ensures all meta tags, structured data, and content are in the initial HTML response -- no JS rendering delays for search engines. The `@astrojs/sitemap` integration auto-generates a valid sitemap with all 74 pages (1 homepage + 73 landing pages). Each landing page has unique titles, descriptions, canonical URLs, per-page `WebApplication` and `FAQPage` JSON-LD, rich static content (format descriptions, FAQs, related converters), and internal cross-linking. The `robots.txt` correctly points to the auto-generated `sitemap-index.xml`.

However, the audit identified several concrete gaps: (1) a stale static `sitemap.xml` in `web/static/` that ends up alongside the auto-generated sitemap in the build output with placeholder `[domain]` URLs, (2) the homepage `WebApplication` schema has an outdated description listing only 5 formats while the app supports 10, (3) the `meta keywords` tag is the same on all 74 pages and adds zero SEO value, (4) no favicon or apple-touch-icon assets exist, (5) the `og:image` references a non-existent `og-image.png`, (6) Google Fonts are loaded render-blocking without `font-display` control, (7) no `BreadcrumbList` structured data for landing pages, (8) the homepage has no internal links to any of the 73 landing pages, and (9) no `theme-color` meta tag.

**Primary recommendation:** Fix the stale static sitemap, update the homepage schema description, remove the dead `meta keywords` tag, create the missing favicon and OG image assets, add `font-display: swap` to Google Fonts, and add internal links from the homepage to landing pages. These are the highest-impact, lowest-effort improvements.

---

## Current State Analysis

### What Exists (Working Well)

| SEO Element | Status | File(s) | Notes |
|---|---|---|---|
| Unique `<title>` per page | Present | `Base.astro`, `index.astro`, `[from]-to-[to].astro` | Correctly set from props, not JS. Homepage: 89 chars (long -- see issues). Landing pages: ~60 chars (good). |
| Unique `<meta description>` per page | Present | Same as above | Homepage: 155 chars. Landing pages: ~130 chars. Good lengths. |
| `<link rel="canonical">` per page | Present | `Base.astro` line 40 | Self-referencing canonical on every page. Conditional: only rendered when `canonical` prop is provided. |
| Open Graph tags | Present | `Base.astro` lines 49-56 | `og:title`, `og:description`, `og:type`, `og:url`, `og:image` all present. Twitter card set to `summary_large_image`. |
| `robots.txt` | Present | `web/static/robots.txt` | Correct: `Allow: /`, points to `sitemap-index.xml`. |
| Auto-generated sitemap | Present | `astro.config.ts` line 10 | `@astrojs/sitemap` integration active. Build output has `sitemap-index.xml` + `sitemap-0.xml` with all 74 URLs. |
| `WebApplication` JSON-LD | Present | `Base.astro` lines 15-25 (default), `[from]-to-[to].astro` lines 28-38 (per-page override) | Landing pages use `skipDefaultSchema` to provide their own page-specific schema. Good pattern. |
| `FAQPage` JSON-LD | Present | `index.astro` lines 31-76, `[from]-to-[to].astro` lines 40-51 | Homepage has 5 FAQs. Landing pages have per-pair FAQs from `format-copy.json`. All rendered server-side. |
| `<html lang="en">` | Present | `Base.astro` line 29 | Correct. |
| Screen-reader accessible H1 | Present | `index.astro` line 96, `FormatTickerHeader.astro` line 39 | H1 uses `sr-only` class because visual ticker replaces it. Good pattern. |
| Heading hierarchy | Correct | Both pages | H1 > H2 > H3 hierarchy followed correctly. |
| Semantic `<main>` tag | Present | Both pages | Wraps primary content. |
| Static HTML content | Present | Both page types | Crawlable text: format descriptions, how-it-works, privacy messaging, FAQs. Not JS-rendered. |
| Related converters (internal links) | Present | `[from]-to-[to].astro` lines 167-190 | Each landing page links to up to 6 related conversion pages. Dense internal link graph. |
| `meta robots` | Present | `Base.astro` line 39 | `index, follow` on all pages. |
| Unique per-page content | Present | `format-copy.json` | 73 entries with unique body text, headlines, and FAQs for each format pair. |
| ARIA/accessibility attributes | Present | Multiple components | `aria-hidden` on decorative elements, `aria-label` on buttons, `role="alert"` on errors, `alt` on images. |

### Issues Found

#### Issue 1: Stale Static `sitemap.xml` in `web/static/` (HIGH Priority)

**File:** `web/static/sitemap.xml`

The `web/static/` directory contains a hand-written `sitemap.xml` with placeholder `https://[domain]/` URLs. Because `publicDir` is set to `./static` in `astro.config.ts`, this file is copied verbatim to `dist/sitemap.xml` alongside the auto-generated `dist/sitemap-0.xml` and `dist/sitemap-index.xml`.

The result: the build output contains **both** `sitemap.xml` (stale, single URL with `[domain]` placeholder) and `sitemap-index.xml` (correct, auto-generated with all 74 URLs). The `robots.txt` correctly points to `sitemap-index.xml`, so Google will likely use the correct one. However, the stale `sitemap.xml` is confusing and could cause issues if any tool or search engine discovers it directly.

**Fix:** Delete `web/static/sitemap.xml`. The `@astrojs/sitemap` integration already generates the correct sitemap.

#### Issue 2: Homepage `WebApplication` Schema Has Outdated Description (HIGH Priority)

**File:** `web/src/layouts/Base.astro` lines 19-20

The default `WebApplication` JSON-LD in `Base.astro` has:
```
"description": "Convert images between PNG, JPEG, WebP, GIF, and BMP formats."
```

The app now supports 10 formats: PNG, JPEG, WebP, GIF, BMP, TIFF, ICO, QOI, TGA, and HEIC (input only). The schema description is stale and lists only 5 formats. The `<title>` and `<meta description>` on the homepage are already updated to include all formats, but the structured data was not updated to match.

**Fix:** Update the description in the `WebApplication` schema in `Base.astro` to match the current format list.

#### Issue 3: Identical `meta keywords` Tag on All Pages (MEDIUM Priority)

**File:** `web/src/layouts/Base.astro` lines 37-38

Every page has the same `meta keywords` tag:
```html
<meta name="keywords" content="image converter, png to jpeg, webp to png, convert image online, free image converter">
```

Two problems:
1. **Google has not used `meta keywords` as a ranking signal since 2009.** Confirmed by Google and by multiple SEO sources in 2026. It provides zero ranking benefit.
2. **It is identical across all 74 pages.** Even if any engine used it, the same static keywords on `/heic-to-bmp` as on `/png-to-jpeg` would not help.

**Fix:** Remove the `meta keywords` tag entirely from `Base.astro`. It adds no value and is 1 line of noise in the `<head>`.

#### Issue 4: Missing `og-image.png` and Favicon Assets (HIGH Priority)

**File:** `web/src/layouts/Base.astro` lines 43-45, 53

The `<head>` contains a TODO comment:
```html
<!-- TODO: Design favicon and apple-touch-icon assets. -->
```

And references a non-existent file:
```html
<meta property="og:image" content="https://imagetoolz.app/og-image.png">
```

The `web/static/` directory contains only `robots.txt` and `sitemap.xml` -- no `og-image.png`, no `favicon.ico`, no `apple-touch-icon.png`. When this OG image URL is fetched by social media crawlers (Twitter, LinkedIn, Slack, Discord), it will 404.

**Impact:**
- Social shares will have no preview image -- significantly reduces click-through from social
- No favicon means browser tabs show a generic icon -- looks unprofessional
- No `apple-touch-icon` means iOS home screen bookmarks have no icon

**Fix:** Create and add to `web/static/`:
- `og-image.png` (1200x630px) -- social sharing preview
- `favicon.ico` -- browser tab icon
- `favicon.svg` -- modern browsers prefer SVG favicons
- `apple-touch-icon.png` (180x180px) -- iOS bookmark icon
- Add proper `<link rel="icon">` and `<link rel="apple-touch-icon">` tags in `Base.astro`

#### Issue 5: Google Fonts Loaded Without `font-display` Control (MEDIUM Priority)

**File:** `web/src/layouts/Base.astro` lines 66-71

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet" />
```

The Google Fonts URL uses `display=swap`, which is good -- it prevents invisible text during font loading. However, three issues remain:

1. **Three font families from an external CDN** -- requires DNS lookup + connection to `fonts.googleapis.com` and `fonts.gstatic.com`, which delays rendering. The `preconnect` hints help but don't eliminate the cost.
2. **Render-blocking `<link rel="stylesheet">`** -- the font CSS is a render-blocking resource. The browser cannot display any content until this stylesheet is fetched.
3. **`font-display: swap` causes CLS** -- when the system font is replaced by the web font, layout shift occurs. For the ticker text (Space Grotesk at `clamp(7rem, 9vw, 9rem)`), a font swap would cause a very large CLS.

**Impact on Core Web Vitals:**
- **LCP:** Delayed by external font loading (render-blocking CSS)
- **CLS:** Potential layout shift when fonts load and text reflows

**Fix (recommended approach):** Self-host the three font files (download WOFF2 from Google Fonts, place in `web/static/fonts/`), use `@font-face` declarations with `font-display: swap` in the CSS. This eliminates the external DNS lookup, removes render-blocking cross-origin CSS, and gives full control over `font-display` behavior. The `preconnect` hints can then be removed.

**Alternative (lower effort):** Add `&display=optional` to the Google Fonts URL for body text (Share Tech Mono) to avoid CLS, and keep `display=swap` only for the display fonts (Space Grotesk, Orbitron) where the custom font is essential to the brand.

#### Issue 6: No `BreadcrumbList` Structured Data on Landing Pages (LOW Priority)

Landing pages have a clear hierarchy: Home > PNG to JPEG Converter. Adding `BreadcrumbList` schema enables Google to display breadcrumb trails in search results instead of raw URLs. This improves the visual appearance of search results and helps users understand site structure.

Current search result URL display: `imagetoolz.app > png-to-jpeg`
With BreadcrumbList: `Image Toolz > PNG to JPEG Converter`

**Fix:** Add a `BreadcrumbList` JSON-LD script to each landing page:

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Image Toolz",
      "item": "https://imagetoolz.app/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "PNG to JPEG Converter",
      "item": "https://imagetoolz.app/png-to-jpeg"
    }
  ]
}
```

This can be generated programmatically in `[from]-to-[to].astro` using the existing `pair` data.

#### Issue 7: No Internal Links from Homepage to Landing Pages (MEDIUM Priority)

**File:** `web/src/pages/index.astro`

The homepage lists 10 format descriptions (PNG, JPEG, WebP, GIF, BMP, TIFF, ICO, QOI, TGA, HEIC/HEIF) in the "Supported Formats" section, but **none of them link to the landing pages**. The only way to discover `/png-to-jpeg` from the homepage is through the sitemap. Google can follow sitemap links, but internal links from the homepage carry much more PageRank than sitemap-only discovery.

The landing pages already link to each other (Related Converters section), but the homepage -- the highest-authority page -- has zero outgoing links to any of the 73 landing pages.

**Fix:** Add links from the homepage format descriptions to the relevant landing pages. Options:
1. Under each format card (e.g., PNG), add links: "Convert PNG to: JPEG | WebP | GIF | BMP | ..."
2. Add a "Popular Conversions" section with links to the most common format pairs
3. Make the format names in the Supported Formats section link to a list of related conversion pages

#### Issue 8: Missing `twitter:image` Tag (LOW Priority)

**File:** `web/src/layouts/Base.astro`

The OG image is set via `og:image`, and `twitter:card` is set to `summary_large_image`, but there is no `twitter:image` meta tag. Twitter (X) will fall back to `og:image`, but explicitly setting `twitter:image` is a best practice because:
- Some services only check Twitter-specific tags
- It allows using a different image optimized for Twitter's aspect ratio if needed

**Fix:** Add `<meta name="twitter:image" content={...}>` in `Base.astro`, using the same URL as `og:image`.

#### Issue 9: Homepage Title is 89 Characters (LOW Priority)

**File:** `web/src/pages/index.astro` lines 25-26

```
Free Image Converter -- PNG, JPEG, WebP, GIF, BMP, TIFF, ICO, QOI, TGA | Online & Private
```

This is 89 characters. Google typically truncates titles at ~580px (roughly 50-60 characters). The format list after "BMP" will be cut off in most search results.

**Impact:** Users see a truncated title in search results. The key differentiator "Online & Private" is hidden.

**Fix:** Shorten to fit within 60 characters. Options:
- `Free Image Converter -- 10+ Formats | Online & Private` (56 chars)
- `Free Online Image Converter | Private & Fast | Image Toolz` (59 chars)
- `Image Converter -- PNG, JPEG, WebP & More | Free & Private` (58 chars)

The full format list is already in the `<meta description>` and the visible H1, so truncating it from the title does not lose information.

#### Issue 10: No `theme-color` Meta Tag (LOW Priority)

No `<meta name="theme-color">` is set. This tag controls the browser toolbar color on mobile Chrome/Safari and the title bar color in desktop PWA mode. For a cyberpunk-themed dark app, setting it to the background color improves the visual experience.

**Fix:** Add to `Base.astro`:
```html
<meta name="theme-color" content="#05050f">
```

#### Issue 11: `og:image` Dimensions Not Specified (LOW Priority)

The `og:image` tag exists but `og:image:width` and `og:image:height` are not specified. Some social media platforms use these dimensions to pre-allocate space before the image loads, preventing layout shift in preview cards.

**Fix:** Add alongside the existing `og:image` tag:
```html
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
```

#### Issue 12: No `WebSite` Schema with `SearchAction` (LOW Priority)

The site has no `WebSite` schema. Adding one with a `potentialAction` of type `SearchAction` could enable Google's sitelinks search box, though this is more relevant for larger sites. More importantly, a `WebSite` schema establishes the site entity for AI crawlers.

---

## Gap Analysis Summary

### Prioritized Issues

| Priority | Issue | Effort | SEO Impact | File(s) to Change |
|---|---|---|---|---|
| P0 | Delete stale `web/static/sitemap.xml` | 1 min | Prevents confusion, removes invalid URLs | Delete `web/static/sitemap.xml` |
| P0 | Create missing `og-image.png` | 30 min | Social sharing preview images | `web/static/og-image.png`, `Base.astro` |
| P0 | Create missing favicon assets | 30 min | Brand presence in tabs and bookmarks | `web/static/favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, `Base.astro` |
| P1 | Update homepage `WebApplication` schema description | 5 min | Accurate structured data for 10 formats | `web/src/layouts/Base.astro` line 20 |
| P1 | Add internal links from homepage to landing pages | 30 min | PageRank distribution to 73 landing pages | `web/src/pages/index.astro` |
| P1 | Self-host Google Fonts (or add `display=optional`) | 1 hr | Faster LCP, eliminate render-blocking CSS | `web/src/layouts/Base.astro`, `web/src/styles.css`, `web/static/fonts/` |
| P2 | Remove `meta keywords` tag | 2 min | Cleanup (no ranking impact, but reduces noise) | `web/src/layouts/Base.astro` line 37-38 |
| P2 | Shorten homepage title to <60 chars | 5 min | Full title visible in search results | `web/src/pages/index.astro` line 26 |
| P2 | Add `twitter:image` meta tag | 2 min | Explicit Twitter card image | `web/src/layouts/Base.astro` |
| P2 | Add `BreadcrumbList` JSON-LD to landing pages | 20 min | Breadcrumb display in search results | `web/src/pages/[from]-to-[to].astro` |
| P3 | Add `theme-color` meta tag | 1 min | Mobile browser toolbar matches dark theme | `web/src/layouts/Base.astro` |
| P3 | Add `og:image` dimension meta tags | 1 min | Social preview layout stability | `web/src/layouts/Base.astro` |
| P3 | Add `WebSite` schema | 10 min | AI crawler entity recognition | `web/src/layouts/Base.astro` |

---

## Architecture Patterns

### Pattern 1: Homepage Internal Link Hub

**What:** Add a "Popular Conversions" or "All Converters" section to the homepage that links to the top landing pages.

**When to use:** Now. The homepage is the highest-authority page and should distribute link equity to the 73 landing pages.

**Example:**
```astro
---
import { buildFormatPairs, type FormatPair } from '../data/format-pairs'

// Get all pairs for internal linking
const allPairs = buildFormatPairs()
// Prioritize high-traffic pairs
const popularSlugs = [
  'png-to-jpeg', 'jpeg-to-png', 'webp-to-png', 'webp-to-jpeg',
  'heic-to-jpeg', 'heic-to-png', 'png-to-webp', 'gif-to-png',
  'bmp-to-png', 'tiff-to-jpeg', 'png-to-ico', 'jpeg-to-webp',
]
const popularPairs = popularSlugs
  .map(slug => allPairs.find(p => p.slug === slug))
  .filter((p): p is FormatPair => p !== undefined)
---

<section style="margin-top: 3rem;">
  <h2>// POPULAR CONVERSIONS</h2>
  <div class="grid sm:grid-cols-3 gap-3">
    {popularPairs.map((p) => (
      <a href={`/${p.slug}`}>
        {p.fromMeta.displayName} to {p.toMeta.displayName}
      </a>
    ))}
  </div>
</section>
```

### Pattern 2: BreadcrumbList Schema Generation

**What:** Generate `BreadcrumbList` JSON-LD for each landing page from existing pair data.

**When to use:** On all landing pages.

**Example:**
```astro
---
// In [from]-to-[to].astro frontmatter:
const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Image Toolz',
      item: `${BASE_URL}/`,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: pair.h1,
      item: pair.canonical,
    },
  ],
}
---

<script slot="head" type="application/ld+json" set:html={JSON.stringify(breadcrumbSchema)} />
```

### Pattern 3: Self-Hosted Google Fonts

**What:** Download WOFF2 files from Google Fonts, serve them from `web/static/fonts/`, and declare `@font-face` rules in CSS.

**When to use:** When Core Web Vitals optimization matters (it does for SEO).

**Example:**
```css
/* In web/src/styles.css */
@font-face {
  font-family: 'Space Grotesk';
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/space-grotesk-700.woff2') format('woff2');
}

@font-face {
  font-family: 'Orbitron';
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/orbitron-400.woff2') format('woff2');
}

@font-face {
  font-family: 'Orbitron';
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/orbitron-700.woff2') format('woff2');
}

@font-face {
  font-family: 'Orbitron';
  font-weight: 900;
  font-display: swap;
  src: url('/fonts/orbitron-900.woff2') format('woff2');
}

@font-face {
  font-family: 'Share Tech Mono';
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/share-tech-mono-400.woff2') format('woff2');
}
```

Then remove the three Google Fonts `<link>` tags from `Base.astro`.

### Pattern 4: Proper Favicon Markup

**What:** Add comprehensive favicon/icon markup in `Base.astro`.

**Example:**
```html
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

### Anti-Patterns to Avoid

- **Adding `meta keywords` per page:** Wastes time. Google ignores them. Bing claims minimal use but provides negligible value.
- **Setting SEO meta tags via JavaScript:** The `<title>`, `<meta description>`, `<link rel="canonical">`, and `og:*` tags must be in the initial HTML. The project already does this correctly via Astro SSG -- do not add any JS-based meta tag manipulation.
- **Exact-duplicate content across landing pages:** The `format-copy.json` already handles this with unique content per pair. Do not use a generic template that produces the same text with only format names swapped -- Google detects this as thin/doorway content.
- **Using `font-display: block`:** This makes text invisible until the font loads, hurting both LCP and user experience.
- **Adding more than 3-4 JSON-LD scripts per page:** Excessive structured data can look like schema spam. The current 2-3 per page (WebApplication + FAQPage + optional BreadcrumbList) is appropriate.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Sitemap generation | Manual XML | `@astrojs/sitemap` (already in use) | Auto-discovers all routes, handles index/pagination |
| Structured data validation | Manual JSON checks | [schema.org Validator](https://validator.schema.org/) or Google's Rich Results Test | Catches schema errors before deployment |
| Favicon generation | Manual pixel pushing | [realfavicongenerator.net](https://realfavicongenerator.net/) | Generates all sizes, formats, and markup for every platform |
| OG image generation | Manual design | Figma template or [og-image.vercel.app](https://og-image.vercel.app/) | Ensures correct 1200x630 dimensions, generates multiple variants |
| Font subsetting | Manual WOFF2 conversion | [google-webfonts-helper](https://gwfh.mranftl.com/fonts) | Provides optimized WOFF2 downloads with ready-to-use `@font-face` CSS |

---

## Common Pitfalls

### Pitfall 1: Stale Static Files Shadowing Auto-Generated Files

**What goes wrong:** A hand-written `sitemap.xml` in the `static/` directory shadows or coexists with the auto-generated sitemap from `@astrojs/sitemap`. Both end up in `dist/`, potentially confusing crawlers.

**Why it happens:** The `@astrojs/sitemap` integration generates `sitemap-index.xml` and `sitemap-0.xml`, not `sitemap.xml`. The old hand-written `sitemap.xml` is not overwritten -- it is copied separately.

**How to avoid:** Delete any hand-written sitemap or robots.txt that overlaps with auto-generated output. The `robots.txt` in `web/static/` is fine because `@astrojs/sitemap` does not generate one.

### Pitfall 2: OG Image 404

**What goes wrong:** Social media platforms attempt to fetch `og-image.png` and get a 404. The share preview shows no image -- just text. This significantly reduces click-through rates on social shares.

**Why it happens:** The `og:image` meta tag was added during planning but the actual image file was never created.

**How to avoid:** Check that every URL referenced in `<meta>` tags actually resolves. Add a build-time or E2E test that verifies `og:image` URLs return 200.

### Pitfall 3: Render-Blocking Google Fonts

**What goes wrong:** The entire page rendering is blocked until the Google Fonts CSS is fetched from an external CDN. On slow connections, this can add 500ms-2s to LCP.

**Why it happens:** `<link rel="stylesheet">` is render-blocking by default. The `preconnect` hints reduce DNS time but don't eliminate the round-trip.

**How to avoid:** Self-host fonts or use `media="print" onload="this.media='all'"` trick for non-critical fonts. The cyberpunk design heavily depends on custom fonts, so self-hosting with `font-display: swap` is the cleanest approach.

### Pitfall 4: Homepage Not Linking to Landing Pages

**What goes wrong:** The homepage -- the highest-authority page on the site -- has no links to the 73 landing pages. All the PageRank stays at the homepage level. Landing pages receive link equity only from each other (Related Converters sections) and the sitemap.

**Why it happens:** The landing pages and homepage were likely built at different times. The homepage was complete before the landing pages were added.

**How to avoid:** Add a "Popular Conversions" section or add links within the existing format cards.

---

## Code Examples

### Delete the Stale Sitemap

```bash
rm web/static/sitemap.xml
```

### Update Homepage Schema in Base.astro

```astro
<!-- In web/src/layouts/Base.astro, update the webAppSchema: -->
const webAppSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Image Toolz',
  description:
    'Convert images between PNG, JPEG, WebP, GIF, BMP, TIFF, ICO, QOI, and TGA formats. HEIC input supported. Runs entirely in your browser — no server uploads.',
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Any (browser-based)',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  browserRequirements: 'Requires WebAssembly support',
  url: BASE_URL,
}
```

### Remove Meta Keywords

```diff
<!-- In web/src/layouts/Base.astro, remove: -->
-    <meta
-      name="keywords"
-      content="image converter, png to jpeg, webp to png, convert image online, free image converter"
-    />
```

### Add Favicon and OG Image Markup

```html
<!-- In web/src/layouts/Base.astro <head>, replace the TODO comment with: -->
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#05050f">
```

### Add twitter:image

```html
<!-- In web/src/layouts/Base.astro, after the twitter:description tag: -->
<meta name="twitter:image" content={`${BASE_URL}/og-image.png`} />
```

### Add og:image Dimensions

```html
<!-- In web/src/layouts/Base.astro, after the og:image tag: -->
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `meta keywords` tag | Not used by Google | Deprecated by Google in 2009 | Remove -- wastes bytes, adds no value |
| External Google Fonts via `<link>` | Self-hosted WOFF2 with `font-display` | 2023-2024 best practice shift | Eliminates external DNS, render-blocking CSS, improves LCP |
| Dynamic rendering (prerender.io) | SSG (Astro) | Google deprecated dynamic rendering 2024 | Project already uses SSG -- correct |
| JS-injected meta tags | Server-rendered meta in static HTML | 2022-2024 | Project already uses SSG -- correct |
| Manual sitemap.xml | `@astrojs/sitemap` auto-generation | 2023+ | Project already uses auto-generation -- but has stale manual file alongside |

**Deprecated/outdated:**
- **`meta keywords`**: Google has not used this as a ranking signal since 2009. Still present in `Base.astro`.
- **External Google Fonts**: Not deprecated, but self-hosting is the current best practice for Core Web Vitals optimization.

---

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest 4.x (unit), Playwright 1.58.x (E2E) |
| Config file | `web/vitest.config.ts`, `web/playwright.config.ts` |
| Quick run command | `cd web && npm run test` |
| Full suite command | `cd web && npm run tests` |

### Existing SEO Tests

| Test | File | Type | What It Covers |
|---|---|---|---|
| `/png-to-jpeg` returns 200 with correct title | `web/tests/e2e/landing-pages.spec.ts` | E2E | Title tag correctness |
| `/png-to-jpeg` has correct canonical | Same | E2E | Canonical URL |
| `/heic-to-jpeg` returns 200 | Same | E2E | HEIC landing pages work |
| `/png-to-png` returns 404 | Same | E2E | Self-pair exclusion |
| `/tga-to-png` returns 404 | Same | E2E | TGA input exclusion |
| Converter widget renders | Same | E2E | Island hydration |
| Sitemap contains format pair URLs | Same | E2E (build check) | Sitemap correctness |
| `buildFormatPairs()` returns 73 pairs | `web/tests/unit/format-pairs.test.ts` | Unit | Pair count |
| No self-pairs | Same | Unit | `from !== to` guard |
| No TGA as input | Same | Unit | TGA exclusion |
| Unique titles/descriptions/canonicals | Same | Unit | No duplicate meta |
| All slugs have format-copy entry | Same | Unit | Content completeness |

### Requirements --> Test Map for Improvements

| Requirement | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| No stale sitemap.xml in build output | Build output has no `sitemap.xml` with `[domain]` placeholder | unit / build check | `cd web && npm run build && ! grep '\[domain\]' dist/sitemap.xml 2>/dev/null` | No -- needs creating |
| Homepage schema lists all formats | `WebApplication.description` in homepage HTML mentions TIFF, ICO, QOI | E2E | `cd web && npm run test:e2e` | No -- needs creating |
| `og-image.png` exists | Static file serves with 200 | E2E | `cd web && npm run test:e2e` | No -- needs creating |
| `favicon.ico` exists | Static file serves with 200 | E2E | `cd web && npm run test:e2e` | No -- needs creating |
| Homepage links to landing pages | Homepage HTML contains at least one `href="/png-to-jpeg"` | E2E | `cd web && npm run test:e2e` | No -- needs creating |
| No `meta keywords` tag in HTML | Build output has no `<meta name="keywords"` | E2E or build check | `cd web && npm run test:e2e` | No -- needs creating |
| BreadcrumbList schema present on landing pages | JSON-LD with `@type: BreadcrumbList` in landing page HTML | E2E | `cd web && npm run test:e2e` | No -- needs creating |

### Gaps (files to create before implementation)

- [ ] `web/tests/e2e/seo.spec.ts` -- covers: homepage schema description, OG image 200, favicon 200, homepage internal links to landing pages, BreadcrumbList on landing pages, no stale sitemap
- [ ] `web/static/og-image.png` -- required for OG image tag to resolve
- [ ] `web/static/favicon.ico` -- browser tab icon
- [ ] `web/static/favicon.svg` -- modern SVG favicon
- [ ] `web/static/apple-touch-icon.png` -- iOS bookmark icon

---

## Open Questions

1. **OG image design**
   - What we know: Needs to be 1200x630px, should convey "image converter" and the cyberpunk brand.
   - What's unclear: Whether to generate per-page OG images for landing pages (e.g., "PNG to JPEG Converter" text on each) or use a single generic one.
   - Recommendation: Start with a single generic OG image. Per-page OG images can be added later using Astro's image generation capabilities or a service like Vercel OG. The impact of per-page OG images on SEO is minimal -- they primarily improve social sharing appearance.

2. **Font licensing for self-hosting**
   - What we know: Space Grotesk (SIL Open Font License), Orbitron (SIL Open Font License), Share Tech Mono (SIL Open Font License). All three are licensed for self-hosting.
   - What's unclear: Nothing -- this is confirmed.
   - Recommendation: Proceed with self-hosting.

3. **Canonical URL trailing slash consistency**
   - What we know: The auto-generated sitemap uses trailing slashes (`/png-to-jpeg/`), but the canonical URLs in `format-pairs.ts` do not have trailing slashes (`/png-to-jpeg`). The build output shows landing pages at `/png-to-jpeg/index.html`.
   - What's unclear: Whether this mismatch causes Google to treat these as different URLs.
   - Recommendation: Verify whether Astro's `trailingSlash` config (default: `'ignore'`) causes canonical/sitemap mismatches. Consider setting `trailingSlash: 'always'` or `'never'` in `astro.config.ts` and updating canonical URLs to match. Google can usually resolve this, but consistency is better.

4. **Homepage link strategy**
   - What we know: 73 landing pages exist. Linking to all 73 from the homepage would be a large block of links.
   - What's unclear: Optimal number of links to include. Too many may be seen as a link farm.
   - Recommendation: Start with 12-18 "popular" pairs as a curated section. Add a "View all converters" link that expands to show all 73 if needed, or link to a dedicated `/converters` index page.

---

## Sources

### Primary (HIGH confidence)

- Codebase analysis: `web/src/layouts/Base.astro`, `web/src/pages/index.astro`, `web/src/pages/[from]-to-[to].astro`, `web/src/data/format-pairs.ts`, `web/static/robots.txt`, `web/static/sitemap.xml`, `web/astro.config.ts`, `web/dist/` build output -- direct inspection of all SEO-related files
- Previous research: `research/20260306-112252-seo-format-landing-pages.md` -- established architecture for landing pages, competitor URL analysis, meta tag patterns

### Secondary (MEDIUM confidence)

- [Complete Guide to Astro Website SEO](https://eastondev.com/blog/en/posts/dev/20251202-astro-seo-complete-guide/) -- Astro-specific SEO best practices -- Accessed: 2026-03-18
- [Astro, Sitemaps, SEO, and Best Practices -- DatoCMS](https://www.datocms.com/blog/astro-seo-and-datocms) -- Sitemap integration patterns -- Accessed: 2026-03-18
- [Core Web Vitals 2026: Performance Optimization](https://dev.to/studiomeyer-io/core-web-vitals-2026-performance-optimization-for-better-google-rankings-16d6) -- LCP, INP, CLS targets and font optimization -- Published: 2026-02, Accessed: 2026-03-18
- [Self host Google fonts for better Core Web Vitals](https://www.corewebvitals.io/pagespeed/self-host-google-fonts) -- Font self-hosting rationale and method -- Accessed: 2026-03-18
- [Meta Keywords in 2026: Are They Still Worth Your Time?](https://seocaddy.com/blog/meta-keywords) -- Confirmation that Google ignores meta keywords since 2009 -- Accessed: 2026-03-18
- [Structured data: SEO and GEO optimization for AI in 2026](https://www.digidop.com/blog/structured-data-secret-weapon-seo) -- JSON-LD best practices including BreadcrumbList for AI visibility -- Accessed: 2026-03-18
- [Structured Data SEO 2026: Rich Results Guide](https://www.digitalapplied.com/blog/structured-data-seo-2026-rich-results-guide) -- BreadcrumbList, WebSite, and WebApplication schema patterns -- Accessed: 2026-03-18

### Tertiary (LOW confidence)

- Homepage title length optimal range (50-60 chars) -- multiple SEO sources agree, but Google does not publish a hard character limit. Based on pixel-width display truncation that varies by character width. -- Accessed: 2026-03-18
- Per-page OG image impact on SEO -- anecdotal; primarily affects social CTR, not search ranking directly -- Accessed: 2026-03-18

---

## Metadata

**Confidence breakdown:**

- Current state analysis: HIGH -- based on direct codebase inspection of every relevant file and build output
- Stale sitemap issue: HIGH -- verified by reading both `web/static/sitemap.xml` and `web/dist/sitemap.xml`
- Schema description issue: HIGH -- verified by comparing `Base.astro` schema text with actual format list in `ValidFormat` enum
- Font optimization: MEDIUM -- self-hosting is widely recommended but specific LCP impact depends on deployment environment
- BreadcrumbList value: MEDIUM -- Google supports it for rich results, but actual impact varies
- Homepage title length: MEDIUM -- truncation is real but the specific character threshold varies

**Research date:** 2026-03-18
