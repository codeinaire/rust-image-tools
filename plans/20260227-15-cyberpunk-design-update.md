# Plan: Cyberpunk Design Update

**Date:** 2026-02-27
**Status:** Completed

## Goal

Redesign the ImageToolz frontend with a cyberpunk aesthetic: scrolling LED ticker header, neon color palette, jagged clip-path UI panels, and futuristic black backgrounds across all sections.

## Approach

Apply a cyberpunk design system via CSS custom properties and Tailwind utility classes. Use Google Fonts (Orbitron for display, Share Tech Mono for UI text). Implement the scrolling ticker as a pure CSS marquee animation. Style the DropZone with CSS `clip-path` to achieve the jagged/asymmetric corner effect from the sketch. Apply neon glow effects via `box-shadow` and `text-shadow`. Update all static Astro page sections (Privacy, How It Works, Supported Formats, FAQ, Footer) to match the theme. No structural/functional changes — styling only.

**Color palette:**
- Background: `#05050f` (deep space black)
- Panel background: `#0d0d1a` (lighter panel black)
- Primary / ticker: `#ffe600` (cyberpunk yellow)
- Accent 1: `#00f5ff` (neon cyan)
- Accent 2: `#ff0080` (neon magenta)
- Border: `#1e1e3a` (dark blue-gray)
- Text primary: `#e0e0ff` (near-white with blue tint)
- Text muted: `#6060a0`

**Fonts:**
- `Orbitron` — large display headings, ticker
- `Share Tech Mono` — body, labels, stats

## Critical

- Functionality must remain 100% unchanged — this is a visual-only update
- The Preact component logic, hooks, worker, and WASM bindings must not be touched
- Tailwind v4 is in use — use standard utility classes; define custom values via CSS custom properties in `styles.css`
- Keep the Astro + Preact islands architecture intact
- All interactive components remain Preact; static sections remain Astro

## Steps

1. **Design tokens** — Add CSS custom properties and `@font-face` / Google Fonts import to `styles.css`; define all cyberpunk colors, glows, and font stacks as CSS variables
2. **Global base styles** — Apply dark background to `body`, set default font to Share Tech Mono, add subtle scanline overlay via CSS pseudo-element
3. **Scrolling ticker** — Add a `<Ticker>` component (Astro component or inline HTML in `index.astro`) at the very top of the page: full-width bar, Orbitron font, yellow color, right-to-left CSS `@keyframes` marquee animation
4. **DropZone reskin** — Apply `clip-path` polygon for jagged asymmetric corners, neon cyan border with glow, dark panel background, update drag-over state to pulse neon
5. **FormatSelector reskin** — Style the `<select>` dropdown and Convert button with cyberpunk borders, yellow/cyan neon on focus/hover, Orbitron font for the button label
6. **ProgressBar reskin** — Neon cyan animated fill, dark track background, glowing label text
7. **ResultArea reskin** — Dark panel, neon stat labels, cyan Download button with glow effect
8. **ImageConverter wrapper reskin** — Dark panel background, clipped-corner outer container, neon error/warning banners
9. **index.astro static sections reskin** — Update Privacy, How It Works, Supported Formats grid cards, FAQ accordions, and Footer with cyberpunk colors, borders, and typography
10. **Base.astro** — Add Google Fonts preconnect + stylesheet link for Orbitron and Share Tech Mono

## TODOs

- [x] Add CSS custom properties (design tokens) to `styles.css`
- [x] Import Google Fonts (Orbitron, Share Tech Mono) in `Base.astro`
- [x] Add global body/scanline styles in `styles.css`
- [x] Create scrolling ticker in `index.astro`
- [x] Restyle `DropZone.tsx` with clip-path + neon borders
- [x] Restyle `FormatSelector.tsx` (dropdown + button)
- [x] Restyle `ProgressBar.tsx` (neon fill)
- [x] Restyle `ResultArea.tsx` (dark panel, neon stats, cyan download button)
- [x] Restyle `ImageConverter.tsx` (outer wrapper, error/warning banners)
- [x] Update static sections in `index.astro` (Privacy, How It Works, Formats, FAQ, Footer)
- [x] Update `Base.astro` with Google Fonts links

## Open Questions

- Should the scanline overlay be subtle (10% opacity) or more pronounced? Default to subtle (5–8%) to not harm readability.
- Should FAQ accordions use a custom neon disclosure triangle or keep native browser disclosure?

## Verification

- **Human verification (AI agent):** Visually inspect rendered HTML by reading the output files and confirming all class/style changes are present
- **Human verification (user):** Run `cd web && npm run dev` and manually confirm in browser:
  - Ticker scrolls right-to-left with yellow Orbitron text
  - DropZone has jagged clip-path corners and neon cyan border
  - Page background is deep black
  - Panel backgrounds are lighter dark
  - Convert button has neon styling
  - Progress bar is neon cyan
  - All sections (Privacy, How It Works, Formats, FAQ, Footer) follow cyberpunk theme
- **Functional regression check (user):** Upload an image and verify conversion still works end-to-end after styling changes
