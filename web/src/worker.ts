// TypeScript uses Window types by default; declare the Worker-specific postMessage overload.
declare function postMessage(message: unknown, transfer?: Transferable[]): void;

import init, {
  convert_image,
  detect_format,
  get_dimensions,
} from "../../crates/image-converter/pkg/image_converter.js";

import type { WorkerRequest, WorkerResponse } from "./worker-types";

async function initialize(): Promise<void> {
  const start = performance.now();
  try {
    await init();
    const initMs = Math.round(performance.now() - start);
    const response: WorkerResponse = { type: "init", success: true, initMs };
    postMessage(response);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    const response: WorkerResponse = { type: "init", success: false, error };
    postMessage(response);
  }
}

onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  switch (request.type) {
    case "detect_format":
      handleDetectFormat(request.id, request.data);
      break;
    case "convert_image":
      handleConvertImage(request.id, request.data, request.targetFormat);
      break;
    case "get_dimensions":
      handleGetDimensions(request.id, request.data);
      break;
  }
};

function handleDetectFormat(id: number, data: Uint8Array): void {
  try {
    const format = detect_format(data);
    const response: WorkerResponse = {
      type: "detect_format",
      id,
      success: true,
      format,
    };
    postMessage(response);
  } catch (e) {
    postError(id, e);
  }
}

function handleConvertImage(
  id: number,
  data: Uint8Array,
  targetFormat: string,
): void {
  try {
    const result = convert_image(data, targetFormat);
    const response: WorkerResponse = {
      type: "convert_image",
      id,
      success: true,
      data: result,
    };
    // Transfer the result buffer back to main thread (zero-copy, O(1))
    postMessage(response, [result.buffer]);
  } catch (e) {
    postError(id, e);
  }
}

function handleGetDimensions(id: number, data: Uint8Array): void {
  try {
    const dims = get_dimensions(data) as { width: number; height: number };
    const response: WorkerResponse = {
      type: "get_dimensions",
      id,
      success: true,
      width: dims.width,
      height: dims.height,
    };
    postMessage(response);
  } catch (e) {
    postError(id, e);
  }
}

function postError(id: number, e: unknown): void {
  const error = e instanceof Error ? e.message : String(e);
  const response: WorkerResponse = { type: "error", id, error };
  postMessage(response);
}

// Initialize WASM immediately when the Worker is created
initialize();
