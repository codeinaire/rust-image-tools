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

**Playwright is not "the best" in all situations** — and it does not replicate all browser functionality. Known limitations:

- **Safari support is WebKit, not real Safari** — uses the WebKit engine rather than a real Safari build, so some Safari-specific bugs won't surface
- **Mobile is simulated** — emulates mobile viewports and user-agent strings but does not run on real iOS or Android hardware
- **No browser extension testing** — Cypress has limited support here; Playwright does not
- **Some browser internals are inaccessible** — GPU/rendering behaviour, hardware codec paths, and other low-level features cannot be tested
- **Automation detection** — sites that fingerprint or detect headless browsers can block Playwright
- **Flakiness** — timing-sensitive tests can still be flaky despite auto-waiting

**When another tool is a better fit:**

- Real Safari bugs matter → Playwright (only option with any Safari coverage; Cypress has none)
- Heavy React/Vue component debugging → Cypress (time-travel debugger is significantly nicer)
- Enterprise teams using Java or Python → Selenium (W3C standard, broadest language support)
- Real iOS/Android → Appium or platform-native tools (XCUITest, Espresso)

For this project (WASM + Web Workers + TypeScript), Playwright is the right call because jsdom-based tools like Testing Library cannot run WebAssembly or Web Workers at all.

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
| Heavy component debugging, Chrome-focused | Cypress |
| Enterprise, many languages/browsers | Selenium |
| Chrome scripting, scraping, PDFs | Puppeteer |
| Real iOS/Android | Appium, XCUITest, Espresso |
| Component/unit testing (no real browser needed) | Testing Library + Jest |

## References

- [Playwright docs](https://playwright.dev/)
- [Cypress docs](https://docs.cypress.io/)
- [Selenium docs](https://www.selenium.dev/documentation/)
- [Puppeteer docs](https://pptr.dev/)
- Project plan for integration tests: `PLANNING.md` (Testing Strategy → Integration Tests)
