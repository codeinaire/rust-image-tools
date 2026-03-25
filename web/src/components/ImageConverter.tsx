import { useState, useEffect, useCallback, useRef } from 'preact/hooks'
import { useConverter } from '../hooks/useConverter'
import { useClipboardPaste } from '../hooks/useClipboardPaste'
import { useBenchmark } from '../hooks/useBenchmark'
import { useProcessing } from '../hooks/useProcessing'
import { DropZone } from './DropZone'
import { EditPanel } from './EditPanel'
import { TransformModal } from './TransformModal'
import { BenchmarkTable } from './BenchmarkTable'
import { MetadataModal } from './MetadataModal'
import { initAnalytics, trackAppLoaded, trackDownloadClicked } from '../analytics'
import { ValidFormat } from '../types'
import type { InputFormat } from '../types'

const CLIP_LG =
  'polygon(28px 0%, 100% 0%, 100% calc(100% - 28px), calc(100% - 28px) 100%, 0% 100%, 0% 28px)'

/** Debounce delay (ms) before triggering conversion when processing operations change. */
const PROCESSING_DEBOUNCE_MS = 300

interface Props {
  initialFrom?: InputFormat
  initialTo?: ValidFormat
}

/** Top-level image converter widget with drop zone, format selection, and download. */
export function ImageConverter({ initialFrom, initialTo }: Props = {}): preact.JSX.Element {
  const {
    state,
    converter,
    handleFile,
    handleConvert,
    quality,
    setQuality,
    transforms,
    rotateCW,
    rotateCCW,
    toggleTransform,
    undoTransform,
    canUndoTransform,
    setOperations,
  } = useConverter()
  const [targetFormat, setTargetFormat] = useState<ValidFormat>(initialTo ?? ValidFormat.Png)
  const [transformModalOpen, setTransformModalOpen] = useState(false)
  const [metadataModalOpen, setMetadataModalOpen] = useState(false)
  const { benchmarkState, startBenchmark, isMobile } = useBenchmark(
    converter,
    state.fileInfo,
    quality,
  )

  const sourceWidth = state.fileInfo?.width ?? 0
  const sourceHeight = state.fileInfo?.height ?? 0

  const processing = useProcessing(sourceWidth, sourceHeight)

  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  /** Revokes the current preview blob URL. */
  function revokePreviewUrl(): void {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }

  // Sync operations to converter ref and trigger preview on changes
  useEffect(() => {
    setOperations(processing.operations)

    // Clear preview debounce
    if (previewDebounceRef.current !== null) {
      clearTimeout(previewDebounceRef.current)
      previewDebounceRef.current = null
    }

    if (!state.fileInfo || !processing.hasActiveOperations) {
      revokePreviewUrl()
      setPreviewUrl(null)
      return
    }

    // Debounce preview generation
    const ops = processing.operations
    const bytes = state.fileInfo.bytes
    previewDebounceRef.current = setTimeout(() => {
      previewDebounceRef.current = null
      converter
        .previewOperations(bytes, ops, 400)
        .then((result) => {
          // Convert RGBA to blob URL via canvas
          const canvas = document.createElement('canvas')
          canvas.width = result.width
          canvas.height = result.height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            return
          }
          const imageData = new ImageData(
            new Uint8ClampedArray(result.rgba.buffer as ArrayBuffer),
            result.width,
            result.height,
          )
          ctx.putImageData(imageData, 0, 0)
          canvas.toBlob((blob) => {
            if (blob) {
              revokePreviewUrl()
              const url = URL.createObjectURL(blob)
              previewUrlRef.current = url
              setPreviewUrl(url)
            }
          })
        })
        .catch((err: unknown) => {
          console.warn('[image-converter] Preview generation failed:', err)
        })
    }, PROCESSING_DEBOUNCE_MS)

    return () => {
      if (previewDebounceRef.current !== null) {
        clearTimeout(previewDebounceRef.current)
        previewDebounceRef.current = null
      }
    }
  }, [
    processing.operations,
    processing.hasActiveOperations,
    state.fileInfo,
    converter,
    setOperations,
  ])

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      revokePreviewUrl()
    }
  }, [])

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
  const benchmarkDisabled =
    state.status === 'converting' ||
    state.status === 'reading' ||
    benchmarkState.isRunning ||
    benchmarkState.results.length > 0

  /** Tracks download click analytics event. */
  function onDownloadClick() {
    if (state.fileInfo && state.result) {
      trackDownloadClicked({
        source_format: state.fileInfo.sourceFormat,
        target_format: state.result.targetFormat,
        output_size_bytes: state.result.outputSize,
      })
    }
  }

  const panelDisabled = state.status === 'converting' || state.status === 'reading'

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
            &#x26A0; <span id="error-message">{state.error}</span>
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
          transforms={transforms}
          onStartBenchmark={startBenchmark}
          onTransformOpen={() => {
            setTransformModalOpen(true)
          }}
          onMetadataOpen={() => {
            setMetadataModalOpen(true)
          }}
          benchmarkDisabled={benchmarkDisabled}
        />

        {/* Edit panel: visible when an image is loaded */}
        {state.fileInfo && (
          <div>
            {/* Processing preview */}
            {previewUrl && processing.hasActiveOperations && (
              <div
                style={{
                  marginBottom: '0.75rem',
                  border: '1px solid var(--cp-border)',
                  padding: '0.5rem',
                  background: 'var(--cp-panel-light)',
                  textAlign: 'center',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '0.65rem',
                    color: 'var(--cp-muted)',
                    letterSpacing: '0.1em',
                    marginBottom: '0.5rem',
                    textTransform: 'uppercase',
                  }}
                >
                  PREVIEW
                </span>
                <img
                  src={previewUrl}
                  alt="Processing preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '300px',
                    imageRendering: 'auto',
                  }}
                />
              </div>
            )}
            <EditPanel
              resize={processing.state.resize}
              crop={processing.state.crop}
              adjustments={processing.state.adjustments}
              sourceWidth={sourceWidth}
              sourceHeight={sourceHeight}
              onResizeChange={processing.updateResize}
              onCropChange={processing.updateCrop}
              onAdjustmentsChange={processing.updateAdjustments}
              onResetSection={processing.resetOperation}
              onResetAll={processing.resetAll}
              disabled={panelDisabled}
            />
          </div>
        )}

        <BenchmarkTable
          fileInfo={state.fileInfo}
          benchmarkState={benchmarkState}
          onConvertFormat={onConvertFormat}
          conversionResult={state.result}
          convertingFormat={convertingFormat}
          isMobile={isMobile}
        />
      </section>

      {/* Metadata modal */}
      {metadataModalOpen && state.fileInfo?.metadata && (
        <MetadataModal
          metadata={state.fileInfo.metadata}
          onClose={() => {
            setMetadataModalOpen(false)
          }}
        />
      )}

      {/* Transform modal */}
      {transformModalOpen && state.fileInfo && (
        <TransformModal
          fileInfo={state.fileInfo}
          result={state.result}
          transforms={transforms}
          onRotateCW={() => {
            rotateCW(targetFormat)
          }}
          onRotateCCW={() => {
            rotateCCW(targetFormat)
          }}
          onToggleFlipH={() => {
            toggleTransform(targetFormat, 'flip_horizontal')
          }}
          onToggleFlipV={() => {
            toggleTransform(targetFormat, 'flip_vertical')
          }}
          onToggleGrayscale={() => {
            toggleTransform(targetFormat, 'grayscale')
          }}
          onToggleInvert={() => {
            toggleTransform(targetFormat, 'invert')
          }}
          disabled={state.status === 'converting' || state.status === 'reading'}
          onClose={() => {
            setTransformModalOpen(false)
          }}
          onDownloadClick={onDownloadClick}
          onUndo={() => {
            undoTransform(targetFormat)
          }}
          canUndo={canUndoTransform}
        />
      )}
    </div>
  )
}
