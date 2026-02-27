import { formatFileSize } from '../hooks/useConverter'
import type { ConversionResult } from '../hooks/useConverter'

type Props = {
  result: ConversionResult | null
  onDownloadClick: () => void
}

export function ResultArea({ result, onDownloadClick }: Props) {
  if (!result) return null

  const sign = result.changePercent >= 0 ? '+' : ''
  const timeStr =
    result.elapsedMs < 1000
      ? `${result.elapsedMs} ms`
      : `${(result.elapsedMs / 1000).toFixed(1)} s`
  const details = `${formatFileSize(result.inputSize)} → ${formatFileSize(result.outputSize)} (${sign}${result.changePercent.toFixed(0)}%) — ${timeStr}`

  return (
    <div
      id="result-area"
      style={{
        background: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid var(--cp-border)',
        padding: '1rem',
      }}
    >
      <div class="flex flex-col sm:flex-row gap-4 items-start">
        <div class="flex-1">
          <h3
            style={{
              color: 'var(--cp-muted)',
              fontSize: '0.7rem',
              letterSpacing: '0.2em',
              marginBottom: '0.5rem',
            }}
          >
            // OUTPUT PREVIEW
          </h3>
          <img
            src={result.blobUrl}
            style={{
              maxWidth: '100%',
              maxHeight: '16rem',
              border: '1px solid var(--cp-border)',
            }}
            alt={`Converted image (${result.extension.toUpperCase()})`}
          />
        </div>
        <div class="flex-shrink-0 space-y-2">
          <div
            id="result-details"
            style={{
              color: 'var(--cp-text)',
              fontSize: '0.8rem',
              letterSpacing: '0.05em',
            }}
          >
            {details}
          </div>
          <a
            id="download-link"
            href={result.blobUrl}
            download={result.filename}
            data-output-size={result.outputSize}
            onClick={onDownloadClick}
            style={{
              display: 'inline-block',
              background: 'transparent',
              color: 'var(--cp-cyan)',
              border: '1px solid var(--cp-cyan)',
              padding: '0.5rem 1.5rem',
              fontFamily: "'Orbitron', monospace",
              fontSize: '0.75rem',
              letterSpacing: '0.15em',
              fontWeight: '700',
              textDecoration: 'none',
              boxShadow: '0 0 10px rgba(0, 245, 255, 0.3)',
              transition: 'box-shadow 0.2s, background 0.2s',
              clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)',
            }}
          >
            DOWNLOAD
          </a>
        </div>
      </div>
    </div>
  )
}
