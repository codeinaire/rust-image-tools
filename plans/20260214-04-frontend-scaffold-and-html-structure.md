# Plan: Frontend Scaffold & HTML Structure

**Date:** 2026-02-14
**Status:** Done
**PR Scope:** Small — project setup + static HTML
**Depends On:** None (can be developed in parallel with Plans 01-03)

## Goal

Set up the `web/` frontend project with Parcel bundler, TypeScript, and Tailwind CSS v4. Create the `index.html` with the static content structure that will be the foundation for both the UI and SEO.

## Approach

Parcel is used as a zero-config bundler with native WASM support. Tailwind CSS v4 is integrated via PostCSS. The HTML contains the full static content structure (headings, sections, format selector shell) — JavaScript enhances it but the page is usable/crawlable without JS. `main.ts` is a stub entry point that will be fleshed out in later plans.

## Steps

1. Create `web/package.json` with Parcel, TypeScript, Tailwind CSS v4, and PostCSS dependencies
2. Create `web/tsconfig.json` with `strict: true`
3. Create `web/.postcssrc` for Tailwind PostCSS config
4. Create `web/src/index.html` with:
   - Basic HTML5 structure
   - Tool UI area (file input zone, format selector, convert button, preview area, download area — all as static HTML shells)
   - Placeholder sections for SEO content (H1, subheading, How It Works, Supported Formats)
5. Create `web/src/styles.css` with Tailwind directives
6. Create `web/src/main.ts` as minimal entry point (imports styles, logs ready message)
7. Add `.gitignore` entries for `node_modules/`, `dist/`, `.parcel-cache/`
8. Verify `npm install` and `npx parcel src/index.html` works

## Todo

- [x] Create `web/` directory
- [x] Write `web/package.json` with dependencies: parcel, typescript, tailwindcss v4, postcss
- [x] Write `web/tsconfig.json` with `"strict": true`
- [x] Write `web/.postcssrc` for Tailwind PostCSS integration
- [x] Write `web/src/index.html`:
  - [x] HTML5 boilerplate with lang, charset, viewport
  - [x] H1: "Free Image Converter — Convert PNG, JPEG, WebP, GIF, BMP Online"
  - [x] Subheading: "100% private — your images never leave your browser"
  - [x] File drop zone / file input area (static HTML)
  - [x] Format selector area (static HTML)
  - [x] Convert button (static HTML)
  - [x] Preview + download area (static HTML, hidden by default)
  - [x] Error display area (static HTML, hidden by default)
  - [x] Progress bar area (static HTML, hidden by default)
- [x] Write `web/src/styles.css` with Tailwind directives (`@import "tailwindcss"` for v4)
- [x] Write `web/src/main.ts` — minimal entry point
- [x] Update root `.gitignore` for web build artifacts
- [x] Run `npm install` in `web/` and verify no errors
- [x] Run `npx parcel src/index.html` and verify dev server starts
- [x] Verify page loads in browser with styled content

## Key Details from PLANNING.md

**Bundler:** Parcel (zero-config, native WASM support)
**Styling:** Tailwind CSS v4 (utility-first, PostCSS-based)
**Framework:** None (vanilla TypeScript)
**TypeScript:** Strict mode enabled
