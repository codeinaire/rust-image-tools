# Plan: Integration Tests (Playwright)

**Date:** 2026-02-14
**Status:** Draft
**PR Scope:** Medium — Playwright setup + full integration test suite
**Depends On:** Plan 07 (validation + error handling + progress bar — full UI must be functional)

## Goal

Set up Playwright and implement integration tests covering the full pipeline: Worker lifecycle, end-to-end conversion, validation guards, and performance/memory checks.

## Approach

Playwright runs headless browser tests that exercise the real application: file input → Worker → WASM → Worker → main thread → output. Test fixtures are small image files (one per format) checked into `web/tests/fixtures/`. Tests verify both happy paths and error paths, and log performance timings for the full pipeline.

## Steps

1. Install Playwright and configure it for the project
2. Create test fixtures (small test images, one per supported format)
3. Implement Worker lifecycle tests
4. Implement end-to-end conversion tests
5. Implement validation guard tests
6. Implement memory/performance tests
7. Verify all tests pass with `npx playwright test`

## Todo

- [ ] Install Playwright: `npm install -D @playwright/test` and `npx playwright install`
- [ ] Create `web/playwright.config.ts`:
  - [ ] Configure base URL (dev server)
  - [ ] Configure headless mode
  - [ ] Configure webServer to start Parcel dev server before tests
- [ ] Create test fixtures in `web/tests/fixtures/`:
  - [ ] `test.png`, `test.jpg`, `test.webp`, `test.gif`, `test.bmp`
  - [ ] Keep files small (< 100 KB each)
- [ ] **Worker lifecycle tests** (`web/tests/integration/worker.spec.ts`):
  - [ ] WASM initializes in Worker without errors
  - [ ] Worker responds to conversion message (post valid image, receive converted bytes)
  - [ ] Worker returns structured error for invalid bytes (not silent failure)
  - [ ] Multiple sequential conversions work (no memory leaks or stale state)
  - [ ] Worker handles large transfer (~50 MB buffer via transferable objects)
- [ ] **End-to-end conversion tests** (`web/tests/integration/conversion.spec.ts`):
  - [ ] File select → convert → download: verify blob is valid, correct MIME type, non-zero size
  - [ ] Format auto-detection: load JPEG, verify UI shows "JPEG" as source format
  - [ ] Before/after metadata: convert known image, verify dimensions and file sizes in DOM
  - [ ] Error display: load corrupted file, trigger convert, verify user-friendly error shown
- [ ] **Validation guard tests** (`web/tests/integration/validation.spec.ts`):
  - [ ] File size limit: attempt > 200 MB file, verify rejected before Worker, error shown
  - [ ] Dimension limit: load image > 100 MP, verify rejected after dimension check, error shown
- [ ] **Performance & memory tests**:
  - [ ] No main thread blocking: start conversion, verify CSS animation doesn't freeze
  - [ ] Blob URL cleanup: after download, verify `URL.revokeObjectURL()` was called
- [ ] **Performance timing** — each conversion test logs:
  - [ ] `worker_init`, `transfer_to_worker`, `conversion`, `transfer_from_worker`, `total_pipeline`
  - [ ] Format: `[PERF E2E] PNG → JPEG | WxH | worker_init: Xms | ...`
- [ ] Add test scripts to `package.json`: `"test:e2e": "npx playwright test"`
- [ ] Run full test suite and verify all tests pass

## Key Details from PLANNING.md

**Test structure:**
```
web/tests/
├── integration/
│   ├── worker.spec.ts
│   ├── conversion.spec.ts
│   └── validation.spec.ts
└── fixtures/
    ├── test.png, test.jpg, test.webp, test.gif, test.bmp
```

**Pipeline timing metrics:**
| Metric | What it measures |
|--------|-----------------|
| `worker_init` | Time for Worker to load and init WASM |
| `transfer_to_worker` | Time to post image bytes to Worker |
| `conversion` | Time Worker spends on WASM `convert_image()` |
| `transfer_from_worker` | Time to receive result bytes back |
| `total_pipeline` | End-to-end from convert click to output blob |

**Perf log format:**
```
[PERF E2E] PNG → JPEG | 1920x1080 | worker_init: 120 ms | transfer_in: 1 ms | conversion: 77 ms | transfer_out: 0 ms | total: 198 ms
```
