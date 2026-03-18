# Decision: Generation Counter Over Worker Termination for Stale Conversion Invalidation

**Date:** 2026-03-18
**Status:** Accepted

## Context

When a user loads a new image while a transform conversion is still running in the Web Worker, the stale conversion can complete and overwrite state for the new image. We needed a mechanism to invalidate in-flight conversions when `handleFile` runs.

## Options Considered

### Option A: Generation counter increment in handleFile

- **Pros:** One-line fix; zero runtime cost; no user-visible effect; no changes to the Worker or ImageConverter class; already proven pattern (used by `handleConvert` internally and benchmarks in the Worker).
- **Cons:** The stale WASM conversion still runs to completion in the Worker, wasting CPU and memory. On mobile with large images (up to 200 MB / 100 MP), this could mean 15-25 seconds of wasted computation.

### Option B: Worker terminate + recreate

- **Pros:** Immediately kills the stale conversion, freeing CPU and memory; clean slate for WASM (good for mobile memory pressure); no wasted work.
- **Cons:** Requires WASM re-initialization (fetch from cache + compile + `init()`), which blocks `detectFormat` and `getDimensions` in `handleFile` via `await this.ready` — adding visible latency to loading the new image. More complex implementation: `ImageConverter` needs a terminate/recreate method, all pending requests must be rejected, and the `ready` promise must be replaced.

## Decision

Use the generation counter (Option A) as the immediate fix. It solves the correctness bug with minimal code change and no user-facing performance impact for typical image sizes.

Worker termination (Option B) is deferred to a future improvement for cases where large images on mobile devices cause meaningful wasted computation. This is tracked in the roadmap.

## Resources

- `web/src/hooks/useConverter.ts` — `convertGenerationRef` usage in `handleFile` and `handleConvert`
- `web/src/lib/image-converter.ts` — `ImageConverter` class that manages the Worker
- `web/src/worker.ts` — Worker with WASM initialization and conversion handlers
