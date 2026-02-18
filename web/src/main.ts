import './styles.css'

import { MessageType } from './worker-types'
import type { WorkerRequest, WorkerResponse, ImageDimensions } from './worker-types'
import { initUI } from './ui'
import { initAnalytics, trackAppLoaded } from './analytics'

type PendingRequest = {
  resolve: (value: WorkerResponse) => void
  reject: (reason: Error) => void
}

class ImageConverter {
  private readonly worker: Worker
  private readonly ready: Promise<number>
  private readonly pendingRequests = new Map<number, PendingRequest>()
  private readonly resolveInit: (initMs: number) => void
  private readonly rejectInit: (error: Error) => void
  private nextRequestId = 1

  constructor() {
    let resolveInit!: (initMs: number) => void
    let rejectInit!: (error: Error) => void
    this.ready = new Promise<number>((resolve, reject) => {
      resolveInit = resolve
      rejectInit = reject
    })
    this.resolveInit = resolveInit
    this.rejectInit = rejectInit

    this.worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    })
    this.worker.onmessage = this.handleMessage.bind(this)
    this.worker.onerror = this.handleError.bind(this)
  }

  private handleMessage(event: MessageEvent<WorkerResponse>): void {
    const response = event.data

    // Handle init response separately (no request id)
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

    // Handle operation responses
    const pending = this.pendingRequests.get(response.id)
    if (!pending) return
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

    // Reject all pending requests
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

  /// Wait for the WASM module to finish loading. Returns init time in ms.
  ensureReady(): Promise<number> {
    return this.ready
  }

  /// Detect the format of an image from its raw bytes.
  async detectFormat(data: Uint8Array): Promise<string> {
    await this.ready
    const id = this.nextRequestId++
    const response = await this.sendRequest({ type: MessageType.DetectFormat, id, data })
    if (response.type === MessageType.DetectFormat && response.success) {
      return response.format
    }
    throw new Error('Unexpected response type')
  }

  /// Convert an image to the specified target format. Returns the converted bytes.
  async convertImage(data: Uint8Array, targetFormat: string): Promise<Uint8Array> {
    const { data: result } = await this.convertImageTimed(data, targetFormat)
    return result
  }

  /// Convert an image and return the result with Worker-side conversion timing.
  async convertImageTimed(
    data: Uint8Array,
    targetFormat: string,
  ): Promise<{ data: Uint8Array; conversionMs: number }> {
    await this.ready
    const id = this.nextRequestId++
    const response = await this.sendRequest({
      type: MessageType.ConvertImage,
      id,
      data,
      targetFormat,
    })
    if (response.type === MessageType.ConvertImage && response.success) {
      return { data: response.data, conversionMs: response.conversionMs }
    }
    throw new Error('Unexpected response type')
  }

  /// Read image dimensions without fully decoding pixel data.
  async getDimensions(data: Uint8Array): Promise<ImageDimensions> {
    await this.ready
    const id = this.nextRequestId++
    const response = await this.sendRequest({ type: MessageType.GetDimensions, id, data })
    if (response.type === MessageType.GetDimensions && response.success) {
      return { width: response.width, height: response.height }
    }
    throw new Error('Unexpected response type')
  }
}

// Initialize analytics before WASM (no-op without POSTHOG_KEY)
initAnalytics()

// Single instance, initialized eagerly on page load
export const converter = new ImageConverter()
// Expose for integration tests
;(window as unknown as Record<string, unknown>)['__converter'] = converter

converter
  .ensureReady()
  .then((initMs) => {
    console.log(`[image-converter] Ready (WASM init: ${initMs}ms)`)
    trackAppLoaded({ wasm_init_ms: initMs })
  })
  .catch((err) => {
    console.error('[image-converter] Failed to initialize:', err)
  })

// Initialize UI once DOM is ready
initUI()
