# End-to-End Browser Testing Frameworks

End-to-end (E2E) testing frameworks automate real browsers to test web applications from the user's perspective — clicking buttons, filling forms, navigating pages, and asserting on DOM state.

## Why It Matters for This Project

The image converter's critical path crosses multiple boundaries (main thread → Web Worker → WASM → Worker → main thread). Unit tests cover the Rust logic, but only E2E tests can verify the full pipeline works in an actual browser with real WASM execution, Worker communication, and DOM updates.

## Framework Comparison

### Playwright (Microsoft, 2020)

The choice for this project. Built by the team that originally created Puppeteer at Google.

- **Browsers**: Chrome, Firefox, Safari (all first-class)
- **Languages**: JavaScript/TypeScript, Python, Java, C#
- **Strengths**: Fast parallel execution, auto-waiting for elements, native Web Worker and WASM support, good `performance.now()` access for timing tests
- **Trade-off**: Newer ecosystem than Cypress

### Cypress (2017)

The most popular alternative in the frontend world.

- **Browsers**: Chrome-family (best support), Firefox (less mature), no Safari
- **Languages**: JavaScript/TypeScript only
- **Strengths**: Runs inside the browser for excellent debugging, time-travel debugging, large plugin ecosystem
- **Trade-off**: No Safari support is a gap for cross-browser testing. Historically weaker with Web Workers.

### Selenium / WebDriver (2004)

The original browser automation tool. Still dominant in enterprise.

- **Browsers**: Every major browser
- **Languages**: Java, Python, C#, JavaScript, Ruby, and more
- **Strengths**: Broadest browser and language support, W3C standard (WebDriver protocol)
- **Trade-off**: More boilerplate, slower, requires external browser drivers

### Puppeteer (Google, 2017)

Lower-level Chrome automation, often used beyond testing.

- **Browsers**: Chrome/Chromium only (Firefox experimental)
- **Languages**: JavaScript/TypeScript
- **Strengths**: Direct Chrome DevTools Protocol access, great for scraping, screenshots, PDF generation
- **Trade-off**: Single-browser only, lower-level API than Playwright

### Others

- **TestCafe** — Runs as a URL-rewriting proxy, no WebDriver. Multi-browser but less popular now.
- **WebdriverIO** — Node.js wrapper around WebDriver and DevTools protocols. Flexible, good plugin system.

## Quick Decision Guide

| Need | Best fit |
|------|----------|
| Multi-browser + Web Workers/WASM | Playwright |
| React/Vue app, Chrome-focused | Cypress |
| Enterprise, many languages/browsers | Selenium |
| Chrome scripting, scraping, PDFs | Puppeteer |

## References

- [Playwright docs](https://playwright.dev/)
- [Cypress docs](https://docs.cypress.io/)
- [Selenium docs](https://www.selenium.dev/documentation/)
- [Puppeteer docs](https://pptr.dev/)
- Project plan for integration tests: `PLANNING.md` (Testing Strategy → Integration Tests)
