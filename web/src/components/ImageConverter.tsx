import { useState, useEffect, useCallback } from 'preact/hooks'
import { useConverter } from '../hooks/useConverter'
import { useClipboardPaste } from '../hooks/useClipboardPaste'
import { useBenchmark } from '../hooks/useBenchmark'
import { DropZone } from './DropZone'
import { BenchmarkTable } from './BenchmarkTable'
import { initAnalytics, trackAppLoaded, trackDownloadClicked } from '../analytics'
import { ValidFormat } from '../types'
import type { InputFormat } from '../types'

const CLIP_LG =
  'polygon(28px 0%, 100% 0%, 100% calc(100% - 28px), calc(100% - 28px) 100%, 0% 100%, 0% 28px)'

interface Props {
  initialFrom?: InputFormat
  initialTo?: ValidFormat
}

/** Top-level image converter widget with drop zone, format selection, and download. */
export function ImageConverter({ initialFrom, initialTo }: Props = {}): preact.JSX.Element {
  const { state, converter, handleFile, handleConvert, quality, setQuality } = useConverter()
  const [targetFormat, setTargetFormat] = useState<ValidFormat>(initialTo ?? ValidFormat.Png)
  const { benchmarkState, startBenchmark, isMobile } = useBenchmark(
    converter,
    state.fileInfo,
    quality,
  )

  /** Sets the target format and triggers conversion (used by benchmark table rows). */
  const onConvertFormat = useCallback(
    (format: ValidFormat) => {
      setTargetFormat(format)
      void handleConvert(format)
    },
    [handleConvert],
  )

  const onClipboardPaste = useCallback(
    (file: File) => {
      void handleFile(file, 'clipboard_paste')
    },
    [handleFile],
  )

  const clipboardEnabled = state.status !== 'converting' && state.status !== 'reading'
  useClipboardPaste({
    onPaste: onClipboardPaste,
    enabled: clipboardEnabled,
  })

  useEffect(() => {
    initAnalytics()
    converter
      .ensureReady()
      .then((initMs) => {
        trackAppLoaded({ wasm_init_ms: initMs })
      })
      .catch((err: unknown) => {
        console.error('[image-converter] Failed to initialize:', err)
      })
    // Expose for integration tests. Cast needed because convertImageTimed takes
    // ValidFormat (string enum) but the window type uses string for spec-file compatibility.
    window.__converter = converter as unknown as typeof window.__converter
  }, [])

  const canConvert = state.fileInfo !== null && state.status !== 'converting'
  const convertingFormat = state.status === 'converting' ? targetFormat : null

  function onDownloadClick() {
    if (state.fileInfo && state.result) {
      trackDownloadClicked({
        source_format: state.fileInfo.sourceFormat,
        target_format: state.result.targetFormat,
        output_size_bytes: state.result.outputSize,
      })
    }
  }

  return (
    /* Outer border layer: provides neon cyan outline via background + clip-path */
    <div
      style={{
        padding: '2px',
        background: 'var(--cp-cyan)',
        clipPath: CLIP_LG,
        filter: 'drop-shadow(0 0 14px var(--cp-cyan-glow))',
      }}
    >
      {/* Inner panel: dark background */}
      <section
        style={{
          background: 'var(--cp-panel)',
          clipPath: CLIP_LG,
          padding: '1.5rem',
        }}
        class="space-y-6"
      >
        {state.error && (
          <div
            id="error-display"
            style={{
              background: 'var(--cp-magenta-bg)',
              border: '1px solid var(--cp-magenta)',
              padding: '0.75rem 1rem',
              color: '#ff80bf',
              letterSpacing: '0.05em',
              fontSize: '0.875rem',
            }}
            role="alert"
          >
            ⚠ <span id="error-message">{state.error}</span>
          </div>
        )}

        <DropZone
          onFile={(file, method) => {
            void handleFile(file, method)
          }}
          fileInfo={state.fileInfo}
          targetFormat={targetFormat}
          onFormatChange={setTargetFormat}
          onConvert={() => {
            void handleConvert(targetFormat)
          }}
          convertDisabled={!canConvert}
          status={state.status}
          result={state.result}
          estimatedMs={state.estimatedMs}
          showProgress={state.showProgress}
          onDownloadClick={onDownloadClick}
          quality={quality}
          onQualityChange={setQuality}
          pageFromFormat={initialFrom}
          pageToFormat={initialTo}
        />

        <BenchmarkTable
          fileInfo={state.fileInfo}
          benchmarkState={benchmarkState}
          onStartBenchmark={startBenchmark}
          onConvertFormat={onConvertFormat}
          conversionResult={state.result}
          convertingFormat={convertingFormat}
          isMobile={isMobile}
          disabled={state.status === 'converting' || state.status === 'reading'}
        />
      </section>
    </div>
  )
}
