# Decision: Keep Worker as Flat Functions Instead of a Class

**Date:** 2026-02-16
**Status:** Accepted

## Context

The question arose whether `worker.ts` — the Web Worker that handles WASM image conversion — should be restructured into a class, since the main-thread side already uses a class pattern.

## Options Considered

### Option A: Wrap worker code in a class

- **Pros:** Consistent OOP style with the main-thread code; groups related functions under one namespace.
- **Cons:** A worker file is already a singleton by nature (one instance per `new Worker()` call); there is no instance state to encapsulate; the Worker API requires top-level `onmessage` assignment, so a class would still need module-level boilerplate to instantiate and wire up; adds ceremony without benefit.

### Option B: Keep flat functions (current structure)

- **Pros:** Matches the stateless dispatch-table nature of the worker (message in, handler runs, response out); no unnecessary abstraction; simpler and easier to follow.
- **Cons:** If the worker later needs internal state (e.g., caching, queuing), it would need refactoring.

## Decision

Keep the flat function structure (Option B). The worker has no instance state and acts as a simple message dispatcher. A class would add indirection without solving any real problem. If stateful behavior is needed in the future, the code can be refactored at that point.

## Resources

- `web/src/worker.ts` — the worker file under consideration
