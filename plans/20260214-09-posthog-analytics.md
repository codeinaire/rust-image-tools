# Plan: PostHog Analytics

**Date:** 2026-02-14
**Status:** Done
**PR Scope:** Small-Medium — SDK setup + 7 events
**Depends On:** Plan 06 (UI implementation — events fire from UI interactions)

## Goal

Integrate PostHog JS SDK for event tracking with 7 defined events covering the full user journey. API key is environment-based, tracking is disabled in development.

## Approach

PostHog is initialized in `main.ts` with the project API key from an environment variable. All events fire from the main thread (never from the Worker). No image data, filenames, or file contents are ever sent — only metadata (format, size, dimensions, timings). PostHog auto-captures pageviews, sessions, and device info.

## Steps

1. Install `posthog-js` package
2. Initialize PostHog in `main.ts` with env-based API key
3. Disable tracking in development mode
4. Wire up all 7 events at appropriate points in the UI flow
5. Verify events fire correctly in browser dev tools

## Todo

- [x] Install `posthog-js`: `npm install posthog-js`
- [x] Add PostHog API key to environment variable (e.g., `POSTHOG_API_KEY`)
- [x] Initialize PostHog in `main.ts`:
  - [x] `posthog.init(apiKey, { api_host: '...' })`
  - [x] Disable in dev: `posthog.opt_out_capturing()` or check `process.env.NODE_ENV`
- [x] Implement `app_loaded` event:
  - [x] Fire once after WASM Worker initialized
  - [x] Properties: `wasm_init_ms`
- [x] Implement `image_selected` event:
  - [x] Fire when user selects or drops a file
  - [x] Properties: `source_format`, `file_size_bytes`, `width`, `height`, `megapixels`, `input_method` ("drag_drop" or "file_picker")
- [x] Implement `conversion_started` event:
  - [x] Fire when user clicks Convert
  - [x] Properties: `source_format`, `target_format`, `file_size_bytes`, `megapixels`
- [x] Implement `conversion_completed` event:
  - [x] Fire when Worker returns successful result
  - [x] Properties: `source_format`, `target_format`, `input_size_bytes`, `output_size_bytes`, `size_change_pct`, `width`, `height`, `megapixels`, `conversion_ms`, `pipeline_total_ms`
- [x] Implement `conversion_failed` event:
  - [x] Fire when Worker returns error
  - [x] Properties: `source_format` (nullable), `target_format`, `file_size_bytes`, `error_type`, `error_message`
- [x] Implement `validation_rejected` event:
  - [x] Fire when file is rejected before conversion
  - [x] Properties: `reason` ("file_too_large" or "dimensions_too_large"), `file_size_bytes`, `megapixels` (nullable)
- [x] Implement `download_clicked` event:
  - [x] Fire when user clicks download button
  - [x] Properties: `source_format`, `target_format`, `output_size_bytes`
- [x] Verify no image data, filenames, or file contents are included in any event
- [ ] Test events fire in browser Network tab / PostHog debugger
- [ ] Verify events are suppressed in development mode

## Key Details from PLANNING.md

**Event flow:**
```
User lands → app_loaded
User selects file → image_selected → (if rejected) validation_rejected [end]
User clicks Convert → conversion_started → conversion_completed OR conversion_failed
User clicks Download → download_clicked
```

**Privacy:** No image data, filenames, or file contents are ever sent. Only metadata.

**Error types for `conversion_failed`:** `"decode_error"`, `"encode_error"`, `"unsupported_format"`

**Rejection reasons for `validation_rejected`:** `"file_too_large"`, `"dimensions_too_large"`
