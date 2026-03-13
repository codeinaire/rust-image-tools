import type { ValidFormat } from '../../types'
import { FORMATS_WITH_QUALITY } from '../../hooks/useConverter'

interface Props {
  quality: number
  onQualityChange: (quality: number) => void
  targetFormat: ValidFormat
}

/** Renders a quality slider (1-100%) for formats that support quality control. */
export function QualitySlider({
  quality,
  onQualityChange,
  targetFormat,
}: Props): preact.JSX.Element | null {
  if (!FORMATS_WITH_QUALITY.has(targetFormat)) {
    return null
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.5rem 1rem',
      }}
    >
      <div class="cyber-tooltip" style={{ position: 'relative', flexShrink: 0 }}>
        <label
          for="quality-slider"
          style={{
            color: '#ffffff',
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '0.7rem',
            letterSpacing: '0.12em',
            whiteSpace: 'nowrap',
            cursor: 'default',
          }}
        >
          QUALITY:{' '}
          <span
            style={{
              display: 'inline-block',
              width: '1.5ch',
              textAlign: 'right',
              marginRight: '1ch',
            }}
          >
            {quality}%
          </span>
        </label>
        <span class="cyber-tooltip-text">Available for JPEG, PNG, and WebP</span>
      </div>
      <input
        id="quality-slider"
        class="cyber-slider"
        type="range"
        min={1}
        max={100}
        value={quality}
        onInput={(e) => {
          const value = parseInt(e.currentTarget.value, 10)
          const clamped = Math.max(1, Math.min(100, value))
          onQualityChange(clamped)
        }}
        aria-label="Output quality (available for JPEG, PNG, and WebP)"
        aria-valuemin={1}
        aria-valuemax={100}
        aria-valuenow={quality}
        style={{ flex: 1 }}
      />
    </div>
  )
}
