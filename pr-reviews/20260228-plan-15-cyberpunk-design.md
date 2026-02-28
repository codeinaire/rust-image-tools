# Code Review: Plan 15 Cyberpunk Design

**Date:** 2026-02-28
**PR:** https://github.com/codeinaire/rust-image-tools/pull/21
**Author:** codeinaire
**Reviewer:** Claude (AI)
**Status:** Approved with suggestions

## Overview

Implements a cyberpunk visual redesign of the ImageToolz frontend: deep-black backgrounds, neon cyan/yellow/magenta palette, Orbitron + Share Tech Mono fonts, clip-path jagged panels, a scrolling LED ticker, and neon glow effects across all components. Also includes a migration from Parcel to Astro build toolchain (Plan 14 work carried into this branch), an analytics env-var fix for Vite/Astro compatibility, and new tooling (bundle size script, ROADMAP.md). 31 files changed, +3329 / -657.

## Findings

### Bugs

- **`DropZone.tsx` — unused `fileInfo` prop**: `fileInfo: FileInfo | null` is declared in `Props` but never destructured or used inside the component. The prop name implies the drop zone should display the selected filename/size after a file is chosen. If the old component showed this, it is a silent regression.

### Issues & Risks

- **`.astro/` not gitignored**: Six auto-generated Astro cache files (`content-assets.mjs`, `content-modules.mjs`, `content.d.ts`, `data-store.json`, `settings.json`, `types.d.ts`) are deleted in this PR, but `web/.astro/` is not added to `.gitignore`. They will reappear after the next `astro dev` run and risk being accidentally re-committed.
- **Scanline overlay `z-index: 9999`**: The `body::after` scanline pseudo-element sits at z-index 9999. `pointer-events: none` prevents click blocking, but this will layer above any future modals, tooltips, or dropdowns unless they also escalate their z-index. A lower value (e.g. 1000) would be safer.
- **`GIF_SLOW_THRESHOLD_MP` potentially duplicated**: The constant is defined in `ImageConverter.tsx`. If the same value also lives in `useConverter.ts`, there are two sources of truth. Extract to a shared `constants.ts`.
- **Bundle size script wiring not visible**: `scripts/bundle-size.mjs` is added at the repo root but the npm scripts (`npm run bundle-size`, `npm run bundle-size:build`) presumably live in `web/package.json`, which is not shown in the diff. Needs verification.
- **10-minute mtime heuristic in bundle script**: The script uses file modification time within 10 minutes to identify the latest build assets — fragile in CI with clock skew or parallel builds.
- **Functional regression unverifiable from diff**: Components are entirely new files. Without the old implementations for direct comparison, regressions in drag-and-drop handling, progress animation, or blob URL cleanup cannot be ruled out from code alone. Manual browser verification (per the plan) is the right call.

### Suggestions

- **`useWorker` → rename to `useImageConverter`**: The hook returns an `ImageConverter` instance, not a raw `Worker`. The current name is misleading.
- **Non-idiomatic hook initialization**: `useRef` + `if (ref.current === null)` works, but `useMemo(() => new ImageConverter(), [])` is the standard Preact/React idiom for memoized object creation.
- **Clip-path duplication**: The `CLIP` polygon constant in `DropZone.tsx` is used on two divs inline and also defined as `.cyber-clip` in `styles.css` — three instances of the same value. Pick one: apply the CSS utility class or use inline style, not both.
- **Hardcoded rgba values bypassing design tokens**: Several components inline `rgba(0, 245, 255, 0.1)` (cyan + opacity) and `rgba(255, 230, 0, 0.4)` (yellow + opacity) instead of using `--cp-*` tokens. Add `--cp-cyan-glow` and `--cp-yellow-glow` tokens to `styles.css` to keep the palette centralized.

### Positives

- **`analytics.ts` fix is correct**: `process.env.NODE_ENV` → `import.meta.env.MODE` and `POSTHOG_KEY` → `PUBLIC_POSTHOG_KEY` are both necessary changes for Vite/Astro. The `PUBLIC_` prefix is required for Astro to expose env vars to client-side code.
- **Worker message correlation pattern**: `lib/image-converter.ts` uses a `Map<number, PendingRequest>` for request/response correlation — a robust pattern for async worker communication.
- **CSS design token system**: The `--cp-*` custom properties in `styles.css` provide a clean, maintainable palette. All major color roles are represented.
- **Plan documentation quality**: `plans/20260227-15-cyberpunk-design-update.md` is thorough — includes color palette hex values, font choices, a Critical section enforcing styling-only scope, and explicit verification steps.
- **`bundle-sizes.md` log**: Tracking bundle size over time with dated entries is a great practice. The Astro migration visibly reduced JS from 353.6 KB to 211.8 KB raw (89.5 KB → 72.4 KB gzip).
- **`ROADMAP.md`**: Well-structured with difficulty ratings, pros/cons, and bundle size impact per feature.

## Test Coverage

No automated tests were added for the new component implementations or the `useConverter.ts` hook. Verification is entirely manual. For a styling-only PR this is acceptable, however `useConverter.ts` (281 lines) manages a complex state machine — file reading, WASM format detection, megapixel validation, conversion, blob URL lifecycle, progress timeout, and analytics events — and would benefit strongly from unit tests in a follow-up.

## Summary

The cyberpunk redesign is well-executed and the plan was followed faithfully. The main items to address before merge: (1) fix or use the `fileInfo` dead prop in `DropZone.tsx` to restore/confirm file info display; (2) add `web/.astro/` to `.gitignore` to prevent auto-generated cache files from re-appearing; (3) verify the `bundle-size` npm script is wired up in `web/package.json`. The remaining findings are non-blocking suggestions. Run `npm run dev` and manually verify the ticker, clip-path drop zone, conversion flow, and all static sections before merging.

## Implementation Notes

**Date implemented:** 2026-02-28

### Implemented

- **Bug — `DropZone.tsx` unused `fileInfo` prop**: Destructured `fileInfo` and used it to display the loaded filename and format/dimensions in the drop zone, replacing the "DRAG & DROP" prompt once a file is selected. Sub-text changes from the format list to `FORMAT — WxH — click to change`.
- **Issue — Scanline overlay `z-index: 9999`**: Reduced to `1000` in `web/src/styles.css`.
- **Issue — Mtime heuristic in `scripts/bundle-size.mjs`**: Reduced `FRESHNESS_MS` from 10 minutes to 60 seconds.
- **Suggestion — `useWorker` rename**: Created `web/src/hooks/useImageConverter.ts` with the `useImageConverter` function name. Deleted `web/src/hooks/useWorker.ts`. Updated import in `useConverter.ts`.
- **Suggestion — Non-idiomatic hook initialization**: Replaced `useRef + null check` pattern with `useMemo(() => new ImageConverter(), [])` in `useImageConverter.ts`.
- **Suggestion — Clip-path duplication**: Replaced the inline `clipPath: CLIP` style on both divs in `DropZone.tsx` with `class="cyber-clip"`, and removed the `CLIP` module constant.
- **Suggestion — Hardcoded rgba values**: Added `--cp-cyan-glow-subtle`, `--cp-cyan-glow`, `--cp-cyan-glow-strong`, `--cp-yellow-glow`, `--cp-yellow-glow-strong`, `--cp-magenta-bg`, and `--cp-yellow-bg` tokens to `:root` in `styles.css`. Replaced all hardcoded `rgba()` values across `DropZone.tsx`, `ProgressBar.tsx`, `ResultArea.tsx`, `FormatSelector.tsx`, and `ImageConverter.tsx`.

### Skipped / Already Resolved

- **Issue — `.astro/` not gitignored**: Already present in `.gitignore` as `web/.astro/` on line 14. No action needed.
- **Issue — `GIF_SLOW_THRESHOLD_MP` potentially duplicated**: Verified — the constant exists only in `ImageConverter.tsx`; it is not present in `useConverter.ts`. No duplication, no action needed.
- **Issue — Bundle size script wiring**: Verified — `web/package.json` already defines both `bundle-size` and `bundle-size:build` scripts pointing to `../scripts/bundle-size.mjs`. No action needed.
- **Issue — Functional regression check**: Requires manual browser verification. Run `cd web && npm run dev` and confirm drag-and-drop, conversion, progress animation, and download work correctly.
