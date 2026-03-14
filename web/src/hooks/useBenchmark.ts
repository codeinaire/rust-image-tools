import { useState, useRef, useEffect, useCallback } from 'preact/hooks'
import { ValidFormat } from '../types'
import type { BenchmarkResultResponse } from '../types'
import type { ImageConverter } from '../lib/image-converter'
import type { FileInfo } from './useConverter'

/** A successful benchmark result for one format. */
export interface BenchmarkFormatResult {
  format: ValidFormat
  success: true
  data: Uint8Array
  outputSize: number
  conversionMs: number
  changePercent: number
}

/** A failed benchmark result for one format. */
export interface BenchmarkFormatError {
  format: ValidFormat
  success: false
  error: string
}

/** A single entry in the benchmark results list. */
export type BenchmarkEntry = BenchmarkFormatResult | BenchmarkFormatError

/** The full state of a benchmark run. */
export interface BenchmarkState {
  isRunning: boolean
  results: BenchmarkEntry[]
  totalFormats: number
  completedFormats: number
}

const ALL_FORMATS: ValidFormat[] = Object.values(ValidFormat)

const INITIAL_STATE: BenchmarkState = {
  isRunning: false,
  results: [],
  totalFormats: 0,
  completedFormats: 0,
}

/**
 * Manages benchmark lifecycle: starting, receiving incremental results,
 * cancellation on file change, and state tracking.
 */
export function useBenchmark(
  converter: ImageConverter,
  fileInfo: FileInfo | null,
  quality: number,
): {
  benchmarkState: BenchmarkState
  startBenchmark: () => void
  cancelBenchmark: () => void
} {
  const [state, setState] = useState<BenchmarkState>(INITIAL_STATE)
  const cleanupRef = useRef<(() => void) | null>(null)
  const inputSizeRef = useRef<number>(0)

  /** Cancel any running benchmark and reset state. */
  const cancelBenchmark = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    setState(INITIAL_STATE)
  }, [])

  useEffect(() => {
    cancelBenchmark()
  }, [fileInfo, cancelBenchmark])

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }, [])

  /** Start benchmarking the current image against all formats except the source. */
  const startBenchmark = useCallback(() => {
    if (!fileInfo) {
      return
    }

    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }

    const formats = ALL_FORMATS.filter((f) => f !== fileInfo.sourceFormat)
    inputSizeRef.current = fileInfo.file.size

    setState({
      isRunning: true,
      results: [],
      totalFormats: formats.length,
      completedFormats: 0,
    })

    const onResult = (response: BenchmarkResultResponse): void => {
      const inputSize = inputSizeRef.current
      let entry: BenchmarkEntry

      if (response.success) {
        const changePercent = ((response.outputSize - inputSize) / inputSize) * 100
        entry = {
          format: response.format,
          success: true,
          data: response.data,
          outputSize: response.outputSize,
          conversionMs: response.conversionMs,
          changePercent,
        }
      } else {
        entry = {
          format: response.format,
          success: false,
          error: response.error,
        }
      }

      setState((prev) => ({
        ...prev,
        results: [...prev.results, entry],
        completedFormats: prev.completedFormats + 1,
      }))
    }

    const onComplete = (): void => {
      cleanupRef.current = null
      setState((prev) => ({
        ...prev,
        isRunning: false,
      }))
    }

    cleanupRef.current = converter.benchmarkFormats(
      fileInfo.bytes,
      formats,
      quality,
      onResult,
      onComplete,
    )
  }, [converter, fileInfo, quality])

  return { benchmarkState: state, startBenchmark, cancelBenchmark }
}
