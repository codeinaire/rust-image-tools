# Compression Benchmark - Format Size Comparison - Research

**Researched:** 2026-03-15
**Domain:** Web Worker streaming messages, incremental UI rendering, image format benchmarking
**Confidence:** HIGH

## Summary

This feature adds a "Compare all formats" button that benchmarks the uploaded image against all supported output formats, showing a live-updating size comparison table. The implementation requires no Rust/WASM changes -- it reuses the existing `convert_image()` calls. The work is purely TypeScript: new Worker message types for benchmark request/result/complete, a benchmark loop in the Worker, streaming result handling in the ImageConverter class, and a new BenchmarkTable Preact component.

The key architectural decision is how to stream incremental results from the Worker. The existing `ImageConverter` class uses a one-request-one-response pattern via `pendingRequests` Map. For benchmarking, a single request produces N results (one per format). The recommended approach is to add a callback-based method (`benchmarkFormats(data, formats, onResult)`) that registers an event listener rather than using the pending request map. Alternatively, the benchmark can use the existing `convertImageTimed()` method in a loop on the main thread -- simpler but slightly slower due to per-message overhead.

**Primary recommendation:** Add new `BenchmarkImages` message type to the Worker protocol. The Worker iterates formats sequentially, posting a `BenchmarkResult` per format and a final `BenchmarkComplete`. The `ImageConverter` class gets a new `benchmarkFormats()` method that accepts an `onResult` callback for streaming updates. A new `BenchmarkTable` component renders results incrementally with skeleton rows for pending formats.

## Standard Stack

### Core

| Library | Version | Purpose | License | Maintained? | Why Standard |
| ------- | ------- | ------- | ------- | ----------- | ------------ |
| image (Rust) | 0.25 | Image encoding/decoding | MIT/Apache-2.0 | Yes | Already in use; no changes needed |
| preact | 10.x | UI components | MIT | Yes | Already in use for all components |

### Supporting

No additional libraries needed. All functionality is built with existing project dependencies.

## Architecture Options

### Option A: Worker-side benchmark loop with streaming messages (RECOMMENDED)

Add `BenchmarkImages` request type that sends input bytes and list of target formats to the Worker. The Worker loops through formats sequentially, calling `convert_image()` for each, and posts `BenchmarkResult` messages back incrementally. A final `BenchmarkComplete` message signals the end.

| Aspect | Detail |
| ------ | ------ |
| Pros | Single request triggers full benchmark; Worker controls sequencing; clean cancellation via generation counter; minimal main-thread overhead |
| Cons | New message types needed; ImageConverter class needs callback-based method |
| Best When | User wants to see results streaming in as each format completes |

### Option B: Main-thread orchestrated loop using existing convertImage()

The main thread iterates formats and calls `converter.convertImageTimed()` for each one sequentially. No Worker protocol changes needed.

| Aspect | Detail |
| ------ | ------ |
| Pros | Zero Worker changes; reuses existing API; simpler implementation |
| Cons | Each conversion round-trips through postMessage twice (request + response); harder to cancel mid-benchmark; main thread manages the loop |
| Best When | Simplicity is prioritized over clean architecture |

### Option C: Dedicated benchmark Web Worker

Spawn a second Worker for benchmarking so the main converter Worker stays free for normal conversions.

| Aspect | Detail |
| ------ | ------ |
| Pros | Benchmark doesn't block normal conversion; parallel operation |
| Cons | Second WASM initialization; double memory; over-engineered for sequential WASM execution |
| Best When | There's a need to convert while benchmarking simultaneously |

**Recommended: Option A.** It provides the cleanest architecture with streaming results, easy cancellation, and minimal main-thread logic.

## Key Technical Findings

### Worker Message Protocol Extension

New types needed:
- `BenchmarkRequest`: `{ type: MessageType.BenchmarkImages, id: number, data: Uint8Array, formats: ValidFormat[], quality: number }`
- `BenchmarkResultResponse`: `{ type: MessageType.BenchmarkResult, id: number, format: ValidFormat, outputSize: number, conversionMs: number }`
- `BenchmarkCompleteResponse`: `{ type: MessageType.BenchmarkComplete, id: number }`

The `id` field ties all results back to the original request, enabling cancellation. If a new benchmark starts (new id), results from the old id are ignored.

**Confidence: HIGH** -- follows existing message pattern exactly.

### Cancellation Strategy

Use a generation counter in the Worker. When `BenchmarkImages` arrives, increment the counter and store it. Before posting each `BenchmarkResult`, check if the counter still matches. If not, stop the loop. This handles both "new file loaded" and "new benchmark started" cases cleanly.

**Confidence: HIGH** -- standard pattern for cancellable async loops.

### ImageConverter Class Extension

Add a `benchmarkFormats()` method that:
1. Posts a `BenchmarkImages` request
2. Returns a cleanup function for cancellation
3. Accepts an `onResult` callback called for each format result
4. Accepts an `onComplete` callback called when all formats are done

The method should NOT use the existing `pendingRequests` map (which expects one response per request). Instead, register a temporary message listener filtered by the benchmark request id.

**Confidence: HIGH** -- clean separation from existing request/response pattern.

### Format Selection for Benchmark

All `ValidFormat` values except the source format should be benchmarked. The source format IS included since quality settings may produce different sizes. SVG is not in `ValidFormat` so no exclusion needed.

Formats to benchmark: Png, Jpeg, WebP, Gif, Bmp, Qoi, Ico, Tiff, Tga (minus source format = 8 formats typically).

**Confidence: HIGH**

### Quality Handling

Use the current quality slider value for formats that support quality (JPEG, WebP, PNG). For other formats, quality is ignored (same as existing conversion). The `getQualityForFormat()` utility already handles this mapping.

**Confidence: HIGH**

### UI Component Design

The BenchmarkTable component needs:
- A "Compare all formats" button (shown when file is loaded, hidden during conversion)
- A table with columns: Format, Size, Change %, Time, Action
- Skeleton rows for formats not yet completed
- Highlight (visual emphasis) on the smallest output
- "Convert to this" button per row that sets the target format and triggers download
- Progress indicator: "Comparing X/Y formats..."
- The table appears below the main DropZone area

**Confidence: HIGH**

### Transfer Buffer Consideration

For benchmarking, we do NOT need to transfer the output bytes back to the main thread -- we only need the output size. This saves significant memory and time for large images. The Worker should only send `outputSize: number` in `BenchmarkResult`, not the full `Uint8Array`.

**Confidence: HIGH** -- important optimization.

## Open Questions

None -- all design decisions are clear from the requirements and existing codebase patterns.

## Risks

| Risk | Likelihood | Mitigation |
| ---- | ---------- | ---------- |
| Large images cause slow benchmark (9 conversions) | Medium | Show progress indicator; allow cancellation by loading new file |
| Memory pressure from sequential conversions | Low | Worker only reports sizes, drops output bytes immediately; explicit `drop()` not needed in TS but WASM side already handles this |
| ICO format fails for large images (size limits) | Medium | Catch per-format errors gracefully; show "failed" in the table row instead of crashing the whole benchmark |
