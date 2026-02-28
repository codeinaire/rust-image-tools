# Decision: Astro + Preact Islands for Frontend Framework Migration

**Date:** 2026-02-27
**Status:** Accepted

## Context

The vanilla TS + Parcel frontend needs a framework migration (Feature 16) to handle growing UI complexity, and format-specific landing pages (Feature 6) require pre-rendered static HTML for SEO. Both requirements need to be solved together — a plain SPA would break SEO for landing pages.

## Options Considered

### Option A: Vite + Preact + `preact-iso` (SSG)

- **Pros:** Smaller paradigm shift from current setup; Vite is faster than Parcel; Preact adds only ~3–5 KB gzipped; prerendering support built into `@preact/preset-vite`.
- **Cons:** No built-in `<Head>` component — requires `react-helmet-async` or `hoofd` for per-page meta tags; `additionalPrerenderRoutes` list must be maintained manually alongside the router; SSG is bolted onto a tool designed for SPAs rather than being first-class.

### Option B: Astro + Preact Islands

- **Pros:** Static HTML is the default — every page is fully crawlable with zero extra config; `getStaticPaths()` generates all format landing pages cleanly from a single route file; head/meta tags are native Astro syntax, no third-party library needed; Preact island adds ~3–5 KB gzipped; Worker + WASM layer is completely unaffected; Vite under the hood.
- **Cons:** More of a paradigm shift than Option A; dark mode requires a small inline script in `<head>` to avoid flash of wrong theme; PWA support requires `@vite-pwa/astro` specifically rather than plain `vite-plugin-pwa`.

### Option C: React + Next.js

- **Pros:** Mature SSG/SSR, large ecosystem.
- **Cons:** React adds ~100–130 KB gzipped (vs ~3–5 KB for Preact); Next.js is overengineered for a static tool with no server-side data needs; significant bundle size regression.

## Decision

**Astro + Preact Islands (Option B).** The format-specific landing pages (Feature 6) are a concrete near-term goal and Astro handles them natively with `getStaticPaths()`. The static-first architecture matches the deployment model (Netlify/Cloudflare Pages). Preact keeps bundle size minimal (~3–5 KB overhead). The Worker + WASM layer requires zero changes. The cons (dark mode FOUC script, `@vite-pwa/astro`) are minor and well-documented patterns.

All interactive UI lives in a single `<ImageConverter client:idle />` island — justified because the entire converter is one tightly coupled tool with shared state, not independent widgets.

## Resources

- `resources/20260227-astro-preact-islands-architecture.md` — detailed reference on islands, SSG vs SSR vs CSR, and feature compatibility
- `ROADMAP.md` — Feature 6 (Format Landing Pages) and Feature 16 (React Frontend Migration)
- [Astro Islands docs](https://docs.astro.build/en/concepts/islands/)
- [`@vite-pwa/astro`](https://vite-pwa-org.netlify.app/frameworks/astro)
