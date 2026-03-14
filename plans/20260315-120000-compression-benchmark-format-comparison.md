# Plan: Compression Benchmark - Format Size Comparison

**Date:** 2026-03-15
**Status:** Complete
**Research:** research/20260315-120000-compression-benchmark-format-comparison.md

## Goal

Add a "Compare all formats" button that converts the uploaded image to every supported output format in the background, streaming results into a live-updating size comparison table so users can identify the smallest format for their image.

## Approach

Extend the Worker protocol with three new message types: `BenchmarkImages` (request), `BenchmarkResult` (per-format result), and `BenchmarkComplete` (done signal). The Worker iterates formats sequentially, reusing the existing `convert_image()` / `encodeWebpViaCanvas()` paths, and posts only the output size back (not the full byte array). The `ImageConverter` class gets a callback-based `benchmarkFormats()` method. A new `BenchmarkTable` Preact component renders results incrementally with skeleton rows, highlights the smallest format, and provides "Convert to this" buttons. A `useBenchmark` hook manages benchmark state. The benchmark is opt-in (button click) and cancellable (loading a new file or starting a new benchmark aborts the previous one).

## Critical

- Worker must only send `outputSize` in `BenchmarkResult`, NOT the full output bytes -- avoids massive memory transfers.
- Use a generation counter (`benchmarkGeneration`) in the Worker to handle cancellation: if a new `BenchmarkImages` arrives, increment the counter and stop the old loop.
- Catch per-format conversion errors gracefully -- a failed format shows "Error" in its table row, not crash the whole benchmark.
- The `benchmarkFormats()` method in `ImageConverter` must NOT use the existing `pendingRequests` Map (which expects one response per request). Use a dedicated listener pattern.
- WebP benchmark must use `encodeWebpViaCanvas()` (async) just like normal conversion.
- Quality parameter must flow through to benchmark conversions using `getQualityForFormat()`.
- The benchmark button should be disabled during active conversion (`status === 'converting'`).
- `exactOptionalPropertyTypes` is on -- use spread syntax for optional properties, not direct `undefined` assignment.

## Steps

### TypeScript: Types & Enums

- [x] In `web/src/types/enums.ts`, add three new values to the `MessageType` enum: `BenchmarkImages = 'benchmark_images'`, `BenchmarkResult = 'benchmark_result'`, `BenchmarkComplete = 'benchmark_complete'`.

- [x] In `web/src/types/interfaces.ts`, add the `BenchmarkImagesRequest` interface: `{ type: MessageType.BenchmarkImages, id: number, data: Uint8Array, formats: ValidFormat[], quality: number }`.

- [x] In `web/src/types/interfaces.ts`, add the `BenchmarkResultResponse` interface: `{ type: MessageType.BenchmarkResult, id: number, format: ValidFormat, outputSize: number, conversionMs: number }`.

- [x] In `web/src/types/interfaces.ts`, add the `BenchmarkCompleteResponse` interface: `{ type: MessageType.BenchmarkComplete, id: number }`.

- [x] In `web/src/types/interfaces.ts`, add the `BenchmarkErrorResponse` interface: `{ type: MessageType.BenchmarkResult, id: number, format: ValidFormat, error: string }`. This reuses `MessageType.BenchmarkResult` but has an `error` field instead of `outputSize`/`conversionMs`. Use a discriminated union: `BenchmarkResultResponse` has `success: true`, `BenchmarkErrorResponse` has `success: false`.

  Update: Simplify -- make `BenchmarkResultResponse` a union itself:
  ```
  interface BenchmarkResultSuccess { type: MessageType.BenchmarkResult, id: number, format: ValidFormat, success: true, outputSize: number, conversionMs: number }
  interface BenchmarkResultError { type: MessageType.BenchmarkResult, id: number, format: ValidFormat, success: false, error: string }
  type BenchmarkResultResponse = BenchmarkResultSuccess | BenchmarkResultError
  ```

- [x] In `web/src/types/types.ts`, add `BenchmarkImagesRequest` to the `WorkerRequest` union. Add `BenchmarkResultResponse` (both success and error variants) and `BenchmarkCompleteResponse` to the `WorkerResponse` union.

- [x] In `web/src/types/index.ts`, add the new types to the re-exports: `BenchmarkImagesRequest`, `BenchmarkResultSuccess`, `BenchmarkResultError`, `BenchmarkResultResponse`, `BenchmarkCompleteResponse`.

### TypeScript: Worker

- [x] In `web/src/worker.ts`, add a `let benchmarkGeneration = 0` variable at module scope (after imports).

- [x] In `web/src/worker.ts`, add a `handleBenchmarkImages()` async function that:
  1. Increments `benchmarkGeneration` and stores the current value in a local `const myGeneration`.
  2. Iterates over `request.formats` sequentially.
  3. For each format: checks if `myGeneration === benchmarkGeneration` (if not, returns early -- benchmark was cancelled). Then tries to convert using the existing logic (WebP via `encodeWebpViaCanvas()`, others via `convert_image()`). Computes quality using `getQualityForFormat()` logic inline (formats with quality get `request.quality`, others get `undefined`). On success, posts `BenchmarkResultSuccess` with `outputSize` and `conversionMs`. On error, posts `BenchmarkResultError` with the error message.
  4. After the loop (if not cancelled), posts `BenchmarkCompleteResponse`.

- [x] In `web/src/worker.ts`, add the `BenchmarkImages` case to the `onmessage` switch statement, calling `void handleBenchmarkImages(request)`.

- [x] In `web/src/worker.ts`, import `getQualityForFormat` from the types or inline the quality-format check. Since `getQualityForFormat` is in `useConverter.ts` (a hook file), it's better to extract it to a shared utility or inline the logic. Inline approach: create a `const QUALITY_FORMATS = new Set(['jpeg', 'webp', 'png'])` in worker.ts and check `QUALITY_FORMATS.has(format) ? quality : undefined`.

### TypeScript: ImageConverter Class

- [x] In `web/src/lib/image-converter.ts`, add a new public method `benchmarkFormats()` with signature:
  ```typescript
  benchmarkFormats(
    data: Uint8Array,
    formats: ValidFormat[],
    quality: number,
    onResult: (result: BenchmarkResultResponse) => void,
    onComplete: () => void,
  ): () => void
  ```
  The method:
  1. Awaits `this.ready` (need to handle this -- since it returns a cleanup function, not a Promise, start the async work internally).
  2. Posts a `BenchmarkImagesRequest` to the worker with a new request id.
  3. Registers a temporary `onmessage` listener (wrapping the existing one) that filters for `BenchmarkResult` and `BenchmarkComplete` messages matching the request id.
  4. Calls `onResult` for each `BenchmarkResult` and `onComplete` + cleanup for `BenchmarkComplete`.
  5. Returns a cleanup function that removes the listener.

  Implementation detail: Since the existing `handleMessage` already processes all messages, add benchmark-specific handling there. Store benchmark callbacks in instance fields (`benchmarkId`, `onBenchmarkResult`, `onBenchmarkComplete`). In `handleMessage`, if the response type is `BenchmarkResult` or `BenchmarkComplete` and the id matches `benchmarkId`, call the appropriate callback. The cleanup function clears these fields.

- [x] In `web/src/lib/image-converter.ts`, import the new types: `BenchmarkImagesRequest`, `BenchmarkResultResponse`, `BenchmarkCompleteResponse`, `MessageType`.

### TypeScript: useBenchmark Hook

- [x] Create `web/src/hooks/useBenchmark.ts` with a `useBenchmark` hook that manages benchmark state:

  Interface for a single benchmark row result:
  ```typescript
  interface BenchmarkFormatResult {
    format: ValidFormat
    outputSize: number
    conversionMs: number
    changePercent: number
  }
  interface BenchmarkFormatError {
    format: ValidFormat
    error: string
  }
  type BenchmarkEntry = BenchmarkFormatResult | BenchmarkFormatError
  ```

  Hook state:
  ```typescript
  interface BenchmarkState {
    isRunning: boolean
    results: BenchmarkEntry[]
    totalFormats: number
    completedFormats: number
  }
  ```

  The hook accepts `converter: ImageConverter` and `fileInfo: FileInfo | null` and `quality: number` as parameters. It exposes:
  - `benchmarkState: BenchmarkState`
  - `startBenchmark: () => void` -- starts the benchmark for all formats except source format
  - `cancelBenchmark: () => void` -- cancels a running benchmark

  `startBenchmark()`:
  1. Computes target formats: all `ValidFormat` values except `fileInfo.sourceFormat`.
  2. Sets `isRunning = true`, clears `results`, sets `totalFormats`.
  3. Calls `converter.benchmarkFormats(fileInfo.bytes, formats, quality, onResult, onComplete)`.
  4. Stores the cleanup function in a ref.

  `onResult` callback: appends the result to `results` array, increments `completedFormats`.
  `onComplete` callback: sets `isRunning = false`.

  When `fileInfo` changes (new file loaded), cancel any running benchmark and reset state.

### TypeScript: BenchmarkTable Component

- [x] Create `web/src/components/BenchmarkTable.tsx` with the benchmark UI:

  Props:
  ```typescript
  interface Props {
    fileInfo: FileInfo | null
    benchmarkState: BenchmarkState
    onStartBenchmark: () => void
    onSelectFormat: (format: ValidFormat) => void
    disabled: boolean
  }
  ```

  Layout:
  - When `fileInfo` is null, render nothing.
  - When `fileInfo` exists and no benchmark has been run, show a "COMPARE ALL FORMATS" button.
  - When benchmark is running or has results, show the table.

  Table structure:
  - Header row: FORMAT | SIZE | DELTA | TIME | ACTION
  - For each format in the benchmark target list:
    - If result exists: show format name, formatted output size, change % (vs input size), conversion time, "USE" button
    - If result doesn't exist yet (still pending): show format name and skeleton/loading placeholders for other columns
  - Progress indicator above table: "ANALYZING X / Y FORMATS..."
  - After completion, highlight the row with the smallest output size (cyan background tint).

  "USE" button behavior: calls `onSelectFormat(format)` which in the parent sets the target format and could trigger conversion. For MVP, just set the format -- the user can then click EXECUTE.

  Styling: Match the cyberpunk theme. Use the same monospace font, color variables (`--cp-cyan`, `--cp-yellow`, `--cp-muted`, etc.), and letter-spacing as existing components.

### TypeScript: Integration

- [x] In `web/src/components/ImageConverter.tsx`:
  1. Import `useBenchmark` and `BenchmarkTable`.
  2. Call `useBenchmark(converter, state.fileInfo, quality)` to get benchmark state and controls.
  3. Add the `BenchmarkTable` component below the `DropZone`, passing benchmark state, `startBenchmark`, and a `handleSelectFormat` that calls `setTargetFormat`.
  4. Pass `disabled={state.status === 'converting'}` to disable the benchmark button during conversion.

### TypeScript: Shared Quality Utility

- [x] Extract the quality-format check from `web/src/hooks/useConverter.ts` into a shared location. Create `web/src/lib/quality.ts` with:
  ```typescript
  export const FORMATS_WITH_QUALITY: ReadonlySet<ValidFormat> = new Set([ValidFormat.Jpeg, ValidFormat.WebP, ValidFormat.Png])
  export function getQualityForFormat(targetFormat: ValidFormat, quality: number): number | undefined { ... }
  ```
  Update `useConverter.ts` to import from `web/src/lib/quality.ts` instead of defining it locally.

  Note: The worker cannot import from hooks. The worker will use its own inline check (`QUALITY_FORMATS` Set) since it runs in a separate context and cannot import from the main thread modules easily.

## Verification

- [x] `cd web && npm run check:all` passes (typecheck + ESLint + Prettier).
- [x] Manual test: upload an image, click "Compare all formats", verify table populates incrementally.
- [x] Verify the smallest format is highlighted after benchmark completes.
- [x] Verify clicking "USE" on a row sets the target format in the format selector.
- [x] Verify loading a new file cancels a running benchmark and resets the table.
- [x] Verify benchmark button is disabled during active conversion.
- [x] Verify per-format errors show gracefully (e.g., ICO may fail for large images).
