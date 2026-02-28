# Astro + Preact Islands Architecture for React Migration

Covers the rendering model options (CSR, SSG, SSR), why Astro + Preact is the recommended approach for the React Frontend Migration (Feature 16), and how Astro islands work in practice.

---

## Rendering Model Glossary

| Approach | When HTML is generated | Server needed? |
|---|---|---|
| **SSG** (Static Site Generation) | At build time | No |
| **SSR** (Server-Side Rendering) | At request time | Yes |
| **CSR** (Client-Side Rendering) | In the browser | No |

This app is deployed as static files (Netlify/Cloudflare Pages), so **SSG is the right fit** — pre-rendered HTML for SEO, no server cost.

The current vanilla TS app is effectively CSR: the server sends a mostly-complete `index.html`, but any dynamic meta tags or JS-rendered content is invisible to crawlers that don't execute JS.

---

## The SEO Problem with a Plain SPA

A plain React/Preact SPA (CSR) sends:

```html
<div id="app"></div>
```

Search engines may see a blank page. Format-specific landing pages (Feature 6) require unique `<title>` and `<meta description>` in the static HTML — you can't inject those reliably with JS alone.

---

## Option A: Vite + Preact + `preact-iso` (simpler, less capable)

`@preact/preset-vite` supports SSG via prerendering. At build time, Vite renders your component tree to static HTML files per route, then Preact hydrates on the client.

```ts
// vite.config.ts
import preact from '@preact/preset-vite'
export default {
  plugins: [preact({ prerender: { enabled: true } })]
}
```

For format landing pages, explicitly list routes:

```ts
preact({
  prerender: {
    enabled: true,
    additionalPrerenderRoutes: [
      '/png-to-jpeg',
      '/webp-to-png',
      // ...
    ]
  }
})
```

**Limitations:**
- No built-in `<Head>` component — need `react-helmet-async` or `hoofd` for per-page meta tags
- Route list maintained manually alongside the router
- SSG is bolted onto a tool designed for SPAs

---

## Option B: Astro + Preact Islands (recommended)

Astro renders everything as static HTML by default. Interactive components opt in to JS via `client:*` directives — these are called **islands**.

### How islands work

```astro
---
// src/pages/index.astro
---
<html>
  <head>
    <title>Free Image Converter</title>
    <meta name="description" content="..." />
  </head>
  <body>
    <h1>Convert Images Free</h1>

    <!-- Only this component ships JS and hydrates -->
    <ImageConverter client:idle />

    <section><!-- FAQ, static HTML, zero JS --></section>
  </body>
</html>
```

The static content (H1, meta tags, FAQ) is pure HTML — no JS needed, fully crawlable. The `<ImageConverter>` island hydrates after the page is idle.

### `client:*` directive options

| Directive | When it hydrates |
|---|---|
| `client:load` | Immediately on page load |
| `client:idle` | After page is idle (requestIdleCallback) |
| `client:visible` | When the component scrolls into view |
| `client:only` | Client-side only, never SSR'd |

For the converter, `client:idle` is appropriate — the static shell renders instantly, the interactive tool loads shortly after.

### Format-specific landing pages (Feature 6)

Astro's `getStaticPaths()` generates all routes at build time:

```ts
// src/pages/[from]-to-[to].astro
export function getStaticPaths() {
  return FORMAT_PAIRS.map(([from, to]) => ({
    params: { from, to }
  }))
}

const { from, to } = Astro.params
```

Each page gets its own pre-rendered HTML with the correct title and meta description. No third-party head library needed.

---

## Internal Structure of the Island

From Astro's perspective there is one island root. Inside it, the code is structured like any normal Preact app:

```
ImageConverter.tsx        ← island root (the one Astro tag)
├── DropZone.tsx
├── FormatSelector.tsx
├── QualitySlider.tsx
├── TransformControls.tsx
├── ProgressBar.tsx
├── OutputPreview.tsx
└── hooks/
    ├── useConverter.ts
    └── useWorker.ts
```

All internal components share Preact state and context normally. Astro only sees the root.

---

## Multiple Islands — When and When Not To

Islands hydrate in parallel but are **isolated by default** — they don't share React/Preact context.

**Good use of multiple islands:**
- Genuinely independent widgets (e.g. a theme toggle in the header, the converter in the body)

**Bad use of multiple islands:**
- Splitting the converter itself into DropZone + FormatSelector + OutputPreview islands

If you split tightly coupled UI into separate islands, they can't share state. To wire them together you need `nanostores` (Astro's recommended cross-island state library) or `window` events — replacing simple Preact state with an external coordination layer.

**Additional UI risks from over-splitting:**
- Hydration ordering is non-deterministic → brief inconsistent UI states
- Multiple islands hydrating at staggered times → multiple layout shifts → worse CLS score

**Rule of thumb:** one island per independent interactive unit. The entire converter is one unit.

---

## Compatibility with Other Roadmap Features

| Feature | Astro impact |
|---|---|
| Dark Mode (#1) | Need inline `<script>` in `<head>` to set theme class before render, avoids flash of wrong theme. Standard Astro pattern. |
| Format Landing Pages (#6) | First-class support via `getStaticPaths()`. Astro's strongest advantage. |
| PWA / Offline (#13) | Use `@vite-pwa/astro` (not `vite-plugin-pwa` directly). The Astro integration exists and is maintained. |
| All others (#2–5, #7–12, #14–19) | Live entirely inside the Preact island. Astro is invisible to them. |

---

## Why Not SSR?

True SSR (rendering at request time) requires a server or serverless function (Netlify Functions, Cloudflare Workers). For this app, SSG gives identical SEO benefits at zero server cost. The content is not dynamic per-request, so SSR adds complexity with no benefit.

---

## References

- [Astro Islands docs](https://docs.astro.build/en/concepts/islands/)
- [Astro `getStaticPaths`](https://docs.astro.build/en/reference/routing-reference/#getstaticpaths)
- [`@vite-pwa/astro`](https://vite-pwa-org.netlify.app/frameworks/astro)
- [nanostores (cross-island state)](https://github.com/nanostores/nanostores)
- [Roadmap Feature 6 — Format Landing Pages](../ROADMAP.md#6-format-specific-landing-pages-seo)
- [Roadmap Feature 16 — React Frontend Migration](../ROADMAP.md#16-react-frontend-migration)
