# Plan: SEO Optimization

**Date:** 2026-02-14
**Status:** Done
**PR Scope:** Medium — meta tags, structured data, on-page content, static assets
**Depends On:** Plan 04 (frontend scaffold + HTML structure)

## Goal

Implement the full SEO strategy: meta tags, Open Graph / Twitter Cards, JSON-LD structured data (WebApplication + FAQ schemas), on-page content sections, and supporting files (robots.txt, sitemap.xml, favicon).

## Approach

Since the frontend is vanilla TS (not a SPA framework), all static content lives directly in `index.html` — fully crawlable without SSR. The WASM/JS enhances the page with functionality, but content is already in the HTML. Privacy ("your images never leave your browser") is the key differentiator from server-based competitors and should be prominent throughout.

Core Web Vitals are addressed by: static HTML content (fast LCP), fixed-size layout (low CLS), and Worker-based conversion (good INP).

## Steps

1. Add meta tags to `index.html` `<head>`: title, description, keywords, canonical, robots
2. Add Open Graph + Twitter Card meta tags
3. Add JSON-LD structured data: WebApplication schema
4. Add JSON-LD structured data: FAQ schema
5. Add on-page content sections to `index.html` `<body>`:
   - How It Works (3 steps)
   - Supported Formats (brief descriptions)
   - FAQ (matching FAQ schema, rendered as `<details>/<summary>`)
   - Privacy note
6. Create `web/static/robots.txt`
7. Create `web/static/sitemap.xml`
8. Add favicon placeholder and apple-touch-icon reference
9. Ensure WASM loads lazily (deferred, doesn't block page render)

## Todo

- [x] Add `<head>` meta tags to `index.html`:
  - [x] `<title>Free Image Converter — PNG, JPEG, WebP, GIF, BMP | Online & Private</title>`
  - [x] `<meta name="description" content="...">`
  - [x] `<meta name="keywords" content="...">`
  - [x] `<link rel="canonical" href="https://[domain]/">`
  - [x] `<meta name="robots" content="index, follow">`
- [x] Add Open Graph meta tags:
  - [x] `og:title`, `og:description`, `og:type`, `og:url`, `og:image`
- [x] Add Twitter Card meta tags:
  - [x] `twitter:card`, `twitter:title`, `twitter:description`
- [x] Add JSON-LD WebApplication schema:
  - [x] `@type: WebApplication`, name, description, URL, category, offers (free), browser requirements
- [x] Add JSON-LD FAQ schema:
  - [x] "How do I convert a PNG to JPEG?"
  - [x] "Is this image converter safe to use?"
  - [x] "What image formats are supported?"
  - [x] "What is the maximum file size?"
- [x] Add on-page content sections:
  - [x] "How It Works" — 3 steps: drop file, pick format, download
  - [x] "Supported Formats" — brief description of PNG, JPEG, WebP, GIF, BMP
  - [x] FAQ section — rendered as `<details>/<summary>` elements (matches FAQ schema)
  - [x] Privacy note — "Your images never leave your browser" prominently displayed
- [x] Create `web/static/robots.txt` (allow all crawlers)
- [x] Create `web/static/sitemap.xml` (single page for now)
- [x] Add favicon TODO comment in `<head>` (actual assets need design)
- [x] `og-image.png` — TODO for design (referenced in OG meta tag with placeholder domain)
- [x] Verify WASM script tag uses `defer` or is loaded lazily (doesn't block render) — `<script type="module">` is deferred by default
- [x] Verify page renders meaningful content with JavaScript disabled — all content is static HTML
- [ ] Validate structured data with Google's Rich Results Test (manual check — do when deployed)

## Implementation Notes

- Static files (`robots.txt`, `sitemap.xml`) are in `web/static/` and copied to `dist/` via `parcel-reporter-static-files-copy`
- `.parcelrc` created to enable the static files copy reporter
- Domain placeholder `[domain]` used in canonical URL, OG URL, OG image, robots.txt sitemap ref, and sitemap.xml — replace when domain is chosen
- Favicon and `og-image.png` assets need design — TODO comments in place
- Most on-page content (How It Works, Supported Formats, FAQ, Privacy) was added in Plan 06 (UI implementation); this plan added the remaining meta tags and static files

## Key Details from PLANNING.md

**Core Web Vitals targets:**
| Metric | Target | How |
|--------|--------|-----|
| LCP | < 2.5s | Static HTML, small CSS, defer WASM |
| CLS | < 0.1 | Fixed-size layout, no late-loading |
| INP | < 200ms | All conversion in Worker |

**Privacy messaging (key differentiator):**
- "No upload required" / "100% private"
- "Your images never leave your device"
- Prominent in title, meta description, H1, and body content

**Domain placeholder:** Use `[domain]` in canonical/OG URLs — to be replaced when domain is chosen.
