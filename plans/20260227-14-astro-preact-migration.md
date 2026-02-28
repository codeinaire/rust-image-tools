# Plan: Astro + Preact Islands Migration

**Date:** 2026-02-27
**Status:** Done

## Goal

Migrate the frontend from vanilla TypeScript + Parcel to Astro + Preact, replacing imperative DOM manipulation in `ui.ts` with Preact components while keeping the Worker + WASM layer completely untouched.

## Approach

The Worker (`worker.ts`, `worker-types.ts`) and `ImageConverter` class (`main.ts`) are preserved as-is — they are framework-agnostic and run in a separate thread. The migration touches only the UI layer.

The Astro page shell renders static HTML (H1, meta tags, FAQ, supported formats) with zero JS. The interactive converter is a single Preact island (`<ImageConverter client:idle />`). State lives in Preact hooks inside the island.

New project structure:

```
web/
├── src/
│   ├── pages/
│   │   ├── index.astro            ← homepage
│   │   └── [from]-to-[to].astro  ← format landing pages (Feature 6, future)
│   ├── layouts/
│   │   └── Base.astro             ← <html>, <head>, meta tags, Tailwind
│   ├── components/
│   │   ├── ImageConverter.tsx     ← island root (client:idle)
│   │   ├── DropZone.tsx
│   │   ├── FormatSelector.tsx
│   │   ├── ProgressBar.tsx
│   │   └── ResultArea.tsx
│   ├── hooks/
│   │   ├── useConverter.ts        ← wraps ImageConverter class
│   │   └── useWorker.ts           ← Worker lifecycle
│   ├── worker.ts                  ← unchanged
│   ├── worker-types.ts            ← unchanged
│   └── analytics.ts               ← unchanged
├── astro.config.mjs
├── tailwind.config.mjs            ← if needed for v4
└── package.json
```

## Steps

1. **Scaffold Astro project** — install Astro, `@astrojs/preact`, Preact, and update `package.json` scripts (`dev`, `build`, `preview`). Remove Parcel.

2. **Configure Tailwind CSS v4** — install `@astrojs/tailwind` (or the v4-compatible integration) and verify existing utility classes render correctly.

3. **Create `Base.astro` layout** — `<html lang>`, `<head>` with meta charset, viewport, and slots for per-page title/description. Add PostHog inline script if needed.

4. **Migrate static shell to `index.astro`** — move the H1, hero copy, FAQ section, and supported formats list from `index.html` into the Astro page. Confirm static HTML renders without JS.

5. **Port `worker.ts` and `worker-types.ts`** — copy files into `src/`. No logic changes; update import paths only if needed.

6. **Create `useWorker` hook** — encapsulates `new Worker(...)`, `onmessage`, `onerror`, and cleanup on unmount. Returns the `ImageConverter` instance.

7. **Create `useConverter` hook** — wraps `ImageConverter` methods (`detectFormat`, `getDimensions`, `convertImageTimed`) and exposes conversion state (`status`, `progress`, `result`, `error`).

8. **Create `DropZone` component** — drag-and-drop + click-to-browse. Calls `onFile(file)` prop. Mirrors current `dropZone` event listeners in `ui.ts`.

9. **Create `FormatSelector` component** — controlled `<select>` for target format. Shows GIF warning when applicable. Mirrors `formatSelect` logic in `ui.ts`.

10. **Create `ProgressBar` component** — animated progress bar driven by conversion state from `useConverter`. Mirrors progress animation logic in `ui.ts`.

11. **Create `ResultArea` component** — preview image, file size delta, download link. Mirrors `resultArea` logic in `ui.ts`. Handles blob URL creation and revocation on unmount.

12. **Create `ImageConverter.tsx` island root** — composes the above components, holds top-level state via `useConverter`, passes props down. This is the single `client:idle` island in the Astro page.

13. **Migrate `analytics.ts`** — keep file unchanged. Import and call `initAnalytics()` and `trackAppLoaded()` inside the island's `useEffect` on mount.

14. **Verify build output** — run `astro build`, confirm static HTML contains full page content (H1, FAQ, meta description), confirm WASM loads and conversion works end-to-end, confirm download works.

15. **Verify Core Web Vitals** — run Lighthouse on production build; confirm LCP, CLS, INP are not degraded vs the Parcel baseline.

## Critical

- **Worker + WASM layer is off-limits** — `worker.ts`, `worker-types.ts`, and the `ImageConverter` class in `main.ts` must not be changed. Copy them into the new structure, update import paths only if required.
- **Tailwind CSS v4 compatibility** — v4 uses a Vite plugin (`@tailwindcss/vite`), not PostCSS. `@astrojs/tailwind` targets v3. Install `@tailwindcss/vite` directly and add it to `astro.config.mjs` via `vite.plugins`. Do not use `@astrojs/tailwind`.
- **PostHog env var** — `process.env.POSTHOG_KEY` is replaced at build time by Vite/Parcel. In Astro + Vite this becomes `import.meta.env.POSTHOG_KEY` (public env vars must be prefixed `PUBLIC_` in Astro: `PUBLIC_POSTHOG_KEY`). Update `analytics.ts` and the inline script accordingly.
- **Single island** — all interactive UI (DropZone, FormatSelector, ProgressBar, ResultArea) lives inside one `<ImageConverter client:idle />` island. Do not create multiple islands for the converter — they cannot share Preact state.
- **Blob URL cleanup** — `ResultArea` must revoke blob URLs on unmount via `useEffect` cleanup to avoid memory leaks.

## TODOs

- [x] Install Astro + `@astrojs/preact` + Preact; remove Parcel from `package.json`
- [x] Configure Tailwind CSS v4 via `@tailwindcss/vite` in `astro.config.mjs`
- [x] Create `Base.astro` layout with head slots
- [x] Migrate static HTML content to `index.astro`
- [x] Copy `worker.ts` + `worker-types.ts` into new structure
- [x] Create `useWorker` hook
- [x] Create `useConverter` hook
- [x] Create `DropZone` component
- [x] Create `FormatSelector` component
- [x] Create `ProgressBar` component
- [x] Create `ResultArea` component
- [x] Create `ImageConverter.tsx` island root
- [x] Wire `analytics.ts` into island
- [x] Run `astro build` and confirm it completes without errors

## Implementation Discoveries

- **`client:only="preact"` required instead of `client:idle`** — Astro's static generation pass runs in Node.js and server-renders Preact islands before shipping them to the browser. The `ImageConverter` island creates a `new Worker(...)` immediately on instantiation. `Worker` is a browser-only API that doesn't exist in Node.js, so the SSG pass crashed with `Worker is not defined`. Switching to `client:only="preact"` tells Astro to skip server-rendering this component entirely and render it only in the browser. This is the correct directive for any component that uses browser-only APIs (`Worker`, `OffscreenCanvas`, `URL.createObjectURL`, etc.). The SEO-relevant content (H1, meta tags, FAQ) lives in `index.astro` as plain static HTML and is completely unaffected.
- **Leftover `.postcssrc` blocked the build** — Parcel had generated a `.postcssrc` file referencing `@tailwindcss/postcss`. Vite/Astro picked it up and tried to load PostCSS with that plugin, which was no longer installed. Deleted the file; Tailwind v4 is handled entirely by `@tailwindcss/vite` in `astro.config.mjs`.
- **`server.fs.allow: ['..']` needed for WASM in dev** — Vite's dev server restricts file serving to the project root (`web/`). The worker imports the WASM binary from `../../crates/image-converter/pkg/` which is outside that root. Added `vite.server.fs.allow: ['..']` in `astro.config.mjs` to allow serving from the repo root.

## Verification

Checks to perform after the build succeeds — leave unchecked until confirmed:

- [ ] `[human · human]` View page source on production build and confirm H1, FAQ, and meta description are present as static HTML (not JS-rendered)
- [ ] `[e2e · agent]` Drop an image, convert it, and download the result end-to-end in the browser
- [ ] `[e2e · agent]` Confirm WASM loads and the converter is functional with JS enabled
- [ ] `[network · human]` Run Lighthouse on the production build and confirm LCP, CLS, INP are not degraded vs the Parcel baseline

## Open Questions

- **Tailwind CSS v4 + Astro**: The v4 integration uses a Vite plugin rather than PostCSS — confirm `@astrojs/tailwind` supports v4 or whether a manual Vite plugin config is needed.
- **PostHog script placement**: Currently inlined in `index.html`. In Astro this goes in `Base.astro`'s `<head>` — confirm the `process.env.POSTHOG_KEY` env var replacement works with Astro's Vite-based build.
- **Feedback modal**: Currently in `index.html` as static HTML + `feedback.ts`. Decide whether to port this as a Preact component inside the island or keep it as a separate small island.
- **Dark mode (future)**: When Feature 1 is implemented, an inline `<script>` in `Base.astro`'s `<head>` is needed to set the theme class before first paint, preventing flash of wrong theme.
