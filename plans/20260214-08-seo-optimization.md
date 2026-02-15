# Plan: SEO Optimization

**Date:** 2026-02-14
**Status:** Draft
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
6. Create `web/public/robots.txt`
7. Create `web/public/sitemap.xml`
8. Add favicon placeholder and apple-touch-icon reference
9. Ensure WASM loads lazily (deferred, doesn't block page render)

## Todo

- [ ] Add `<head>` meta tags to `index.html`:
  - [ ] `<title>Free Image Converter — PNG, JPEG, WebP, GIF, BMP | Online & Private</title>`
  - [ ] `<meta name="description" content="...">`
  - [ ] `<meta name="keywords" content="...">`
  - [ ] `<link rel="canonical" href="https://[domain]/">`
  - [ ] `<meta name="robots" content="index, follow">`
- [ ] Add Open Graph meta tags:
  - [ ] `og:title`, `og:description`, `og:type`, `og:url`, `og:image`
- [ ] Add Twitter Card meta tags:
  - [ ] `twitter:card`, `twitter:title`, `twitter:description`
- [ ] Add JSON-LD WebApplication schema:
  - [ ] `@type: WebApplication`, name, description, URL, category, offers (free), browser requirements
- [ ] Add JSON-LD FAQ schema:
  - [ ] "How do I convert a PNG to JPEG?"
  - [ ] "Is this image converter safe to use?"
  - [ ] "What image formats are supported?"
  - [ ] "What is the maximum file size?"
- [ ] Add on-page content sections:
  - [ ] "How It Works" — 3 steps: drop file, pick format, download
  - [ ] "Supported Formats" — brief description of PNG, JPEG, WebP, GIF, BMP
  - [ ] FAQ section — rendered as `<details>/<summary>` elements (matches FAQ schema)
  - [ ] Privacy note — "Your images never leave your browser" prominently displayed
- [ ] Create `web/public/robots.txt` (allow all crawlers)
- [ ] Create `web/public/sitemap.xml` (single page for now)
- [ ] Add favicon references in `<head>` (`favicon.ico`, `apple-touch-icon.png`)
- [ ] Create placeholder `og-image.png` (1200x630) or add a TODO for design
- [ ] Verify WASM script tag uses `defer` or is loaded lazily (doesn't block render)
- [ ] Verify page renders meaningful content with JavaScript disabled
- [ ] Validate structured data with Google's Rich Results Test (manual check)

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
