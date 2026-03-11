import { formatFileSize } from '../../hooks/useConverter'
import type { ConversionResult } from '../../hooks/useConverter'

interface Props {
  result: ConversionResult
}

export function ResultStats({ result }: Props): preact.JSX.Element {
  const sign = result.changePercent >= 0 ? '+' : ''
  const changeColor = result.changePercent <= 0 ? 'var(--cp-cyan)' : 'var(--cp-magenta, #ff3399)'

  return (
    <div
      id="result-area"
      style={{
        flex: 1,
        borderRight: '1px solid var(--cp-cyan)',
        display: 'flex',
        alignItems: 'stretch',
      }}
    >
      <span id="result-details" style={{ display: 'none' }} aria-hidden="true">
        {formatFileSize(result.inputSize)} → {formatFileSize(result.outputSize)} —{' '}
        {result.elapsedMs < 1000
          ? `${result.elapsedMs} ms`
          : `${(result.elapsedMs / 1000).toFixed(1)} s`}
      </span>

      {/* Size stat */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 0.25rem',
          borderRight: '1px solid var(--cp-cyan-glow-soft)',
        }}
      >
        <span
          style={{
            color: 'var(--cp-muted)',
            fontSize: '0.55rem',
            letterSpacing: '0.1em',
            lineHeight: 1,
          }}
        >
          SIZE
        </span>
        <span
          style={{
            color: 'var(--cp-text)',
            fontSize: '0.65rem',
            letterSpacing: '0.05em',
            marginTop: '0.2rem',
            whiteSpace: 'nowrap',
          }}
        >
          {formatFileSize(result.inputSize)} → {formatFileSize(result.outputSize)}
        </span>
      </div>

      {/* Change stat */}
      <div
        style={{
          flex: '0 0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 0.75rem',
          borderRight: '1px solid var(--cp-cyan-glow-soft)',
        }}
      >
        <span
          style={{
            color: 'var(--cp-muted)',
            fontSize: '0.55rem',
            letterSpacing: '0.1em',
            lineHeight: 1,
          }}
        >
          DELTA
        </span>
        <span
          style={{
            color: changeColor,
            fontSize: '0.75rem',
            fontFamily: "'Share Tech Mono', monospace",
            letterSpacing: '0.05em',
            marginTop: '0.2rem',
          }}
        >
          {sign}
          {result.changePercent.toFixed(0)}%
        </span>
      </div>

      {/* Time stat */}
      <div
        style={{
          flex: '0 0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 0.75rem',
        }}
      >
        <span
          style={{
            color: 'var(--cp-muted)',
            fontSize: '0.55rem',
            letterSpacing: '0.1em',
            lineHeight: 1,
          }}
        >
          TIME
        </span>
        <span
          style={{
            color: 'var(--cp-text)',
            fontSize: '0.65rem',
            fontFamily: "'Share Tech Mono', monospace",
            letterSpacing: '0.05em',
            marginTop: '0.2rem',
          }}
        >
          {result.elapsedMs < 1000
            ? `${result.elapsedMs} ms`
            : `${(result.elapsedMs / 1000).toFixed(1)} s`}
        </span>
      </div>
    </div>
  )
}
