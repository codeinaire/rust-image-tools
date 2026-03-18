# Plan: SEO Audit Improvements

**Date:** 2026-03-18
**Research:** `research/20260318-120000-seo-audit-and-improvements.md`
**Status:** Complete

## Goal

Fix code-level SEO issues identified in the research audit. This covers: removing the stale static sitemap, updating the homepage WebApplication schema description, removing the dead `meta keywords` tag, shortening the homepage title, adding `twitter:image` and `og:image` dimension meta tags, adding `theme-color` meta tag, adding `BreadcrumbList` structured data on landing pages, and adding internal links from the homepage to landing pages.

Out of scope (per user request): creating image assets (og-image.png, favicon.ico, apple-touch-icon.png), modifying Google Fonts loading.

## Steps

### Step 1: Delete stale static sitemap.xml

**File:** `web/static/sitemap.xml` (DELETE)

Delete the hand-written `sitemap.xml` that contains placeholder `https://[domain]/` URLs. The `@astrojs/sitemap` integration already generates the correct `sitemap-index.xml` and `sitemap-0.xml` with all 74 URLs. The `robots.txt` correctly points to `sitemap-index.xml`, so this stale file is only a source of confusion.

### Step 2: Update homepage WebApplication schema description

**File:** `web/src/layouts/Base.astro` (MODIFY)

Update the `description` field in the `webAppSchema` object from:
```
"Convert images between PNG, JPEG, WebP, GIF, and BMP formats. Runs entirely in your browser -- no server uploads."
```
to:
```
"Convert images between PNG, JPEG, WebP, GIF, BMP, TIFF, ICO, QOI, and TGA formats. HEIC input supported. Runs entirely in your browser -- no server uploads."
```

Also update the `name` field from `"Image Converter"` to `"Image Toolz"` to match the app branding.

Also add `url: BASE_URL` to the schema object so the homepage schema has a URL property (matching the landing page schemas).

### Step 3: Remove meta keywords tag

**File:** `web/src/layouts/Base.astro` (MODIFY)

Remove the `<meta name="keywords" ...>` tag entirely. Google has not used meta keywords as a ranking signal since 2009, and the same static keywords on all 74 pages add zero value.

### Step 4: Shorten homepage title

**File:** `web/src/pages/index.astro` (MODIFY)

Shorten the homepage `<title>` from the current 89-character version:
```
Free Image Converter -- PNG, JPEG, WebP, GIF, BMP, TIFF, ICO, QOI, TGA | Online & Private
```
to a version under 60 characters. The full format list is already in the `<meta description>` and visible H1.

New title (58 chars):
```
Image Converter -- PNG, JPEG, WebP & More | Free & Private
```

### Step 5: Add twitter:image, og:image dimensions, and theme-color meta tags

**File:** `web/src/layouts/Base.astro` (MODIFY)

Add the following meta tags to the `<head>`:

1. `<meta name="twitter:image" content={...}>` after the existing `twitter:description` tag, using the same URL as `og:image`.
2. `<meta property="og:image:width" content="1200">` and `<meta property="og:image:height" content="630">` after the existing `og:image` tag.
3. `<meta name="theme-color" content="#05050f">` in the head section for mobile browser toolbar theming.

### Step 6: Add BreadcrumbList structured data to landing pages

**File:** `web/src/pages/[from]-to-[to].astro` (MODIFY)

Add a `BreadcrumbList` JSON-LD script to each landing page in the frontmatter section, using existing `pair` data:

```js
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
```

Render it as a `<script slot="head" type="application/ld+json">` alongside the existing webAppSchema and faqSchema scripts.

Note: Import `BASE_URL` from `../constants` -- it is already imported in the landing page template via `format-pairs.ts` but needs a direct import for the breadcrumb schema since `pair.canonical` is a full URL while `BASE_URL` is needed for the homepage URL. Actually, `BASE_URL` is already used in `format-pairs.ts` which is imported, but the landing page does not import `BASE_URL` directly. We need to add the import.

### Step 7: Add internal links from homepage to landing pages

**File:** `web/src/pages/index.astro` (MODIFY)

Add a "Popular Conversions" section to the homepage, positioned between the "Supported Formats" section and the "FAQ" section. This section links to a curated set of 12 high-traffic format conversion pairs, distributing PageRank from the homepage to the landing pages.

Import `buildFormatPairs` and `FormatPair` from the data module. Define a curated list of popular slugs:
```
png-to-jpeg, jpeg-to-png, webp-to-png, webp-to-jpeg,
heic-to-jpeg, heic-to-png, png-to-webp, gif-to-png,
bmp-to-png, tiff-to-jpeg, png-to-ico, jpeg-to-webp
```

Render as a grid of links styled consistently with the existing cyberpunk design (panel background, cyan border-left, Orbitron headers), with each link showing the format pair name and the page H1 text.

### Step 8: Run static analysis checks

Run `cd web && npm run check:all` to verify TypeScript, ESLint, and Prettier pass on all modified files. Fix any issues found.

## Verification

After all steps:

1. `cd web && npm run check:all` passes (TypeScript + ESLint + Prettier)
2. `cd web && npm run build` succeeds without errors
3. Build output `dist/` does NOT contain a `sitemap.xml` with `[domain]` placeholder
4. Build output `dist/index.html` contains updated WebApplication schema with all 10 formats
5. Build output `dist/index.html` does NOT contain `<meta name="keywords"`
6. Build output `dist/index.html` contains homepage links to landing pages (e.g., `href="/png-to-jpeg"`)
7. Build output `dist/png-to-jpeg/index.html` contains BreadcrumbList JSON-LD
8. Homepage title is under 60 characters
9. `twitter:image` meta tag present in `<head>`
10. `og:image:width` and `og:image:height` meta tags present
11. `theme-color` meta tag present

## Files Changed

| File | Action |
|---|---|
| `web/static/sitemap.xml` | DELETE |
| `web/src/layouts/Base.astro` | MODIFY (schema description, remove keywords, add meta tags) |
| `web/src/pages/index.astro` | MODIFY (shorten title, add popular conversions section) |
| `web/src/pages/[from]-to-[to].astro` | MODIFY (add BreadcrumbList schema, import BASE_URL) |
