import { useState, useEffect } from 'preact/hooks'
import { useConverter, formatFileSize } from '../hooks/useConverter'
import { DropZone } from './DropZone'
import { FormatSelector } from './FormatSelector'
import { ProgressBar } from './ProgressBar'
import { ResultArea } from './ResultArea'
import { initAnalytics, trackAppLoaded, trackDownloadClicked } from '../analytics'
import type { FileInfo } from '../hooks/useConverter'

const GIF_SLOW_THRESHOLD_MP = 2

const CLIP_LG =
  'polygon(28px 0%, 100% 0%, 100% calc(100% - 28px), calc(100% - 28px) 100%, 0% 100%, 0% 28px)'

function formatSourceDetails(fileInfo: FileInfo): string {
  return `${fileInfo.sourceFormat.toUpperCase()} — ${fileInfo.width}×${fileInfo.height} — ${formatFileSize(fileInfo.file.size)}`
}

export function ImageConverter() {
  const { state, converter, handleFile, handleConvert } = useConverter()
  const [targetFormat, setTargetFormat] = useState('png')

  useEffect(() => {
    initAnalytics()
    converter
      .ensureReady()
      .then((initMs) => {
        trackAppLoaded({ wasm_init_ms: initMs })
      })
      .catch((err: Error) => {
        console.error('[image-converter] Failed to initialize:', err)
      })
    // Expose for integration tests
    ;(window as unknown as Record<string, unknown>)['__converter'] = converter
  }, [])

  const canConvert = state.fileInfo !== null && state.status !== 'converting'
  const gifWarning =
    targetFormat === 'gif' &&
    state.fileInfo !== null &&
    state.fileInfo.megapixels >= GIF_SLOW_THRESHOLD_MP

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
        filter: 'drop-shadow(0 0 14px rgba(0, 245, 255, 0.3))',
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
              background: 'rgba(255, 0, 128, 0.08)',
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

        <DropZone onFile={handleFile} fileInfo={state.fileInfo} />

        {state.fileInfo && (
          <div id="source-info" style={{ fontSize: '0.8rem', letterSpacing: '0.05em' }}>
            <span style={{ color: 'var(--cp-cyan)' }}>{state.fileInfo.file.name}</span>
            <span id="source-details" style={{ marginLeft: '0.5rem', color: 'var(--cp-muted)' }}>
              {formatSourceDetails(state.fileInfo)}
            </span>
          </div>
        )}

        {gifWarning && (
          <div
            style={{
              background: 'rgba(255, 230, 0, 0.05)',
              border: '1px solid var(--cp-yellow)',
              padding: '0.75rem 1rem',
              color: 'var(--cp-yellow)',
              fontSize: '0.8rem',
              letterSpacing: '0.05em',
            }}
            role="status"
          >
            ⚠ GIF encoding requires color quantization (256-color palette). This can be slow for
            large images.
          </div>
        )}

        <FormatSelector
          value={targetFormat}
          onChange={setTargetFormat}
          onConvert={() => handleConvert(targetFormat)}
          disabled={!canConvert}
        />

        <ProgressBar
          status={state.status}
          estimatedMs={state.estimatedMs}
          showProgress={state.showProgress}
        />

        <ResultArea result={state.result} onDownloadClick={onDownloadClick} />
      </section>
    </div>
  )
}
