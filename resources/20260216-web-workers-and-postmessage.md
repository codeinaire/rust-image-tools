# Web Workers and postMessage

## What Are Web Workers?

A Web Worker runs JavaScript in a **background thread**, separate from the main UI thread. This prevents CPU-intensive tasks (like WASM image conversion) from freezing the user interface.

Workers have their own global scope (`self`) with a different set of built-in APIs than the main thread. Notably, workers do **not** have access to `window`, `document`, or the DOM.

## Creating a Worker

```ts
this.worker = new Worker(new URL('./worker.ts', import.meta.url), {
  type: 'module',
});
```

- **`new URL('./worker.ts', import.meta.url)`** — Resolves the worker file path relative to the current module. Bundlers like Parcel detect this pattern, bundle the worker file separately, and replace the URL with the correct output path at build time.
- **`{ type: 'module' }`** — Tells the browser the worker uses ES module syntax (`import`/`export`) rather than classic script syntax.

This is **not** a dynamic import. A regular `import` runs code on the same thread. `new Worker(...)` spawns a separate thread with its own execution context.

## Communication via postMessage

The main thread and worker **cannot share variables**. They communicate by sending messages back and forth:

**Main thread → Worker:**
```ts
this.worker.postMessage({ type: 'convert', data: imageBytes });
```

**Worker → Main thread:**
```ts
// Inside worker.ts
postMessage({ type: 'result', data: convertedBytes });
```

**Listening for messages:**
```ts
// Main thread listens to worker
this.worker.onmessage = (event) => { /* handle event.data */ };

// Worker listens to main thread
onmessage = (event) => { /* handle event.data */ };
```

### Transferable Objects

By default, `postMessage` **copies** data (structured clone). For large buffers like image data, you can **transfer** ownership instead, which is O(1) and zero-copy:

```ts
postMessage(response, [result.buffer]); // transfers the ArrayBuffer
```

After transfer, the sender can no longer access the buffer — ownership moves to the receiver.

## postMessage Is a Browser Built-In

`postMessage` is provided by the browser runtime on the Worker global scope. It is not defined in application code. The `declare` statement sometimes seen in TypeScript worker files:

```ts
declare function postMessage(message: unknown, transfer?: Transferable[]): void;
```

is only a **type declaration** — it tells TypeScript the function exists at runtime and describes its signature. This is needed because TypeScript defaults to `Window` global types, which have a different `postMessage` signature than the Worker global scope.

## Why This Matters for This Project

The Rust/WASM image conversion is CPU-intensive. Running it on the main thread would block all UI interaction until conversion completes. By offloading the work to a Web Worker, the UI remains responsive while images are converted in the background.

## References

- [MDN: Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [MDN: Worker.postMessage()](https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage)
- [MDN: Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)
- [MDN: import.meta.url](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import.meta)
- Project files: `web/src/worker.ts`, `web/src/main.ts`
