import "./styles.css";

import type {
  WorkerRequest,
  WorkerResponse,
  ImageDimensions,
} from "./worker-types";

type PendingRequest = {
  resolve: (value: WorkerResponse) => void;
  reject: (reason: Error) => void;
};

let worker: Worker | null = null;
let wasmReady: Promise<number>;
let resolveInit: (initMs: number) => void;
let rejectInit: (error: Error) => void;
let nextRequestId = 1;
const pendingRequests = new Map<number, PendingRequest>();

function createWorker(): Worker {
  const w = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });

  wasmReady = new Promise<number>((resolve, reject) => {
    resolveInit = resolve;
    rejectInit = reject;
  });

  w.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;

    // Handle init response separately (no request id)
    if (response.type === "init") {
      if (response.success) {
        console.log(
          `[image-converter] WASM initialized in ${response.initMs}ms`,
        );
        resolveInit(response.initMs);
      } else {
        console.error(
          `[image-converter] WASM init failed: ${response.error}`,
        );
        rejectInit(new Error(response.error));
      }
      return;
    }

    // Handle operation responses
    const pending = pendingRequests.get(response.id);
    if (!pending) return;
    pendingRequests.delete(response.id);

    if (response.type === "error") {
      pending.reject(new Error(response.error));
    } else {
      pending.resolve(response);
    }
  };

  w.onerror = (event) => {
    console.error("[image-converter] Worker error:", event.message);
    rejectInit(new Error(event.message));

    // Reject all pending requests
    for (const [id, pending] of pendingRequests) {
      pending.reject(new Error("Worker crashed"));
      pendingRequests.delete(id);
    }
  };

  return w;
}

function getWorker(): Worker {
  if (!worker) {
    worker = createWorker();
  }
  return worker;
}

function sendRequest(request: WorkerRequest): Promise<WorkerResponse> {
  const w = getWorker();
  return new Promise<WorkerResponse>((resolve, reject) => {
    pendingRequests.set(request.id, { resolve, reject });
    w.postMessage(request);
  });
}

// --- Public API ---

/// Wait for the WASM module to finish loading. Returns init time in ms.
export function ensureReady(): Promise<number> {
  getWorker();
  return wasmReady;
}

/// Detect the format of an image from its raw bytes.
export async function detectFormat(data: Uint8Array): Promise<string> {
  await wasmReady;
  const id = nextRequestId++;
  const response = await sendRequest({ type: "detect_format", id, data });
  if (response.type === "detect_format" && response.success) {
    return response.format;
  }
  throw new Error("Unexpected response type");
}

/// Convert an image to the specified target format. Returns the converted bytes.
export async function convertImage(
  data: Uint8Array,
  targetFormat: string,
): Promise<Uint8Array> {
  await wasmReady;
  const id = nextRequestId++;
  const response = await sendRequest({
    type: "convert_image",
    id,
    data,
    targetFormat,
  });
  if (response.type === "convert_image" && response.success) {
    return response.data;
  }
  throw new Error("Unexpected response type");
}

/// Read image dimensions without fully decoding pixel data.
export async function getDimensions(
  data: Uint8Array,
): Promise<ImageDimensions> {
  await wasmReady;
  const id = nextRequestId++;
  const response = await sendRequest({ type: "get_dimensions", id, data });
  if (response.type === "get_dimensions" && response.success) {
    return { width: response.width, height: response.height };
  }
  throw new Error("Unexpected response type");
}

// Initialize worker eagerly on page load
ensureReady()
  .then((initMs) => {
    console.log(`[image-converter] Ready (WASM init: ${initMs}ms)`);
  })
  .catch((err) => {
    console.error("[image-converter] Failed to initialize:", err);
  });
