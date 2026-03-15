import { MessageType, type ValidFormat } from '../types'
import type {
  WorkerRequest,
  WorkerResponse,
  ImageDimensions,
  BenchmarkResultResponse,
} from '../types'

interface PendingRequest {
  resolve: (value: WorkerResponse) => void
  reject: (reason: Error) => void
}

/** Manages the image converter Web Worker and provides a Promise-based API. */
export class ImageConverter {
  private readonly worker: Worker
  private readonly ready: Promise<number>
  private readonly pendingRequests = new Map<number, PendingRequest>()
  private readonly resolveInit: (initMs: number) => void
  private readonly rejectInit: (error: Error) => void
  private nextRequestId = 1
  private activeBenchmarkId: number | null = null
  private benchmarkResultCallback: ((result: BenchmarkResultResponse) => void) | null = null
  private benchmarkCompleteCallback: (() => void) | null = null

  constructor() {
    let resolveInit!: (initMs: number) => void
    let rejectInit!: (error: Error) => void
    this.ready = new Promise<number>((resolve, reject) => {
      resolveInit = resolve
      rejectInit = reject
    })
    this.resolveInit = resolveInit
    this.rejectInit = rejectInit

    this.worker = new Worker(new URL('../worker.ts', import.meta.url), {
      type: 'module',
    })
    this.worker.onmessage = this.handleMessage.bind(this)
    this.worker.onerror = this.handleError.bind(this)
  }

  private handleMessage(event: MessageEvent<WorkerResponse>): void {
    const response = event.data

    if (response.type === MessageType.Init) {
      if (response.success) {
        console.log(`[image-converter] WASM initialized in ${response.initMs}ms`)
        this.resolveInit(response.initMs)
      } else {
        console.error(`[image-converter] WASM init failed: ${response.error}`)
        this.rejectInit(new Error(response.error))
      }
      return
    }

    if (response.type === MessageType.BenchmarkResult && this.activeBenchmarkId === response.id) {
      this.benchmarkResultCallback?.(response)
      return
    }

    if (response.type === MessageType.BenchmarkComplete && this.activeBenchmarkId === response.id) {
      this.benchmarkCompleteCallback?.()
      this.clearBenchmarkCallbacks()
      return
    }

    const pending = this.pendingRequests.get(response.id)
    if (!pending) {
      return
    }
    this.pendingRequests.delete(response.id)

    if (response.type === MessageType.Error) {
      pending.reject(new Error(response.error))
    } else {
      pending.resolve(response)
    }
  }

  private handleError(event: ErrorEvent): void {
    console.error('[image-converter] Worker error:', event.message)
    this.rejectInit(new Error(event.message))

    for (const [id, pending] of this.pendingRequests) {
      pending.reject(new Error('Worker crashed'))
      this.pendingRequests.delete(id)
    }
  }

  private sendRequest(request: WorkerRequest): Promise<WorkerResponse> {
    return new Promise<WorkerResponse>((resolve, reject) => {
      this.pendingRequests.set(request.id, { resolve, reject })
      this.worker.postMessage(request)
    })
  }

  /** Wait for the WASM module to finish loading. Returns init time in ms. */
  ensureReady(): Promise<number> {
    return this.ready
  }

  /** Detect the format of an image from its raw bytes. */
  async detectFormat(data: Uint8Array): Promise<ValidFormat> {
    await this.ready
    const id = this.nextRequestId++
    const response = await this.sendRequest({ type: MessageType.DetectFormat, id, data })
    if (response.type === MessageType.DetectFormat) {
      return response.format
    }
    throw new Error('Unexpected response type')
  }

  /** Convert an image to the specified target format. Returns the converted bytes. */
  async convertImage(
    data: Uint8Array,
    targetFormat: ValidFormat,
    quality?: number,
  ): Promise<Uint8Array> {
    const { data: result } = await this.convertImageTimed(data, targetFormat, quality)
    return result
  }

  /** Convert an image and return the result with Worker-side conversion timing. */
  async convertImageTimed(
    data: Uint8Array,
    targetFormat: ValidFormat,
    quality?: number,
  ): Promise<{ data: Uint8Array; conversionMs: number }> {
    await this.ready
    const id = this.nextRequestId++
    const response = await this.sendRequest({
      type: MessageType.ConvertImage,
      id,
      data,
      targetFormat,
      ...(quality !== undefined ? { quality } : {}),
    })
    if (response.type === MessageType.ConvertImage) {
      return { data: response.data, conversionMs: response.conversionMs }
    }
    throw new Error('Unexpected response type')
  }

  /** Read image dimensions without fully decoding pixel data. */
  async getDimensions(data: Uint8Array): Promise<ImageDimensions> {
    await this.ready
    const id = this.nextRequestId++
    const response = await this.sendRequest({ type: MessageType.GetDimensions, id, data })
    if (response.type === MessageType.GetDimensions) {
      return { width: response.width, height: response.height }
    }
    throw new Error('Unexpected response type')
  }

  private clearBenchmarkCallbacks(): void {
    this.activeBenchmarkId = null
    this.benchmarkResultCallback = null
    this.benchmarkCompleteCallback = null
  }

  /**
   * Benchmark an image against multiple output formats.
   * Results stream in one-by-one via the onResult callback.
   * When withData is true, each result includes the converted bytes for instant download.
   * Returns a cleanup function that cancels the benchmark.
   */
  benchmarkFormats(
    data: Uint8Array,
    formats: ValidFormat[],
    quality: number,
    withData: boolean,
    onResult: (result: BenchmarkResultResponse) => void,
    onComplete: () => void,
  ): () => void {
    this.clearBenchmarkCallbacks()

    const id = this.nextRequestId++
    this.activeBenchmarkId = id
    this.benchmarkResultCallback = onResult
    this.benchmarkCompleteCallback = onComplete

    const request: WorkerRequest = {
      type: MessageType.BenchmarkImages,
      id,
      data,
      formats,
      quality,
      withData,
    }

    void this.ready.then(() => {
      if (this.activeBenchmarkId === id) {
        this.worker.postMessage(request)
      }
    })

    return () => {
      if (this.activeBenchmarkId === id) {
        this.clearBenchmarkCallbacks()
      }
    }
  }
}
