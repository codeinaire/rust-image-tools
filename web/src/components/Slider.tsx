interface SliderProps {
  /** Minimum value of the slider range. */
  min: number
  /** Maximum value of the slider range. */
  max: number
  /** Step increment between values. */
  step: number
  /** Current value. */
  value: number
  /** Callback fired on every input change (real-time). */
  onChange: (value: number) => void
  /** Label text displayed above the slider. */
  label: string
  /** Whether the slider is disabled. */
  disabled?: boolean
}

/**
 * Reusable range slider component with cyberpunk styling.
 * Fires onChange on the `input` event for real-time feedback.
 */
export function Slider({
  min,
  max,
  step,
  value,
  onChange,
  label,
  disabled = false,
}: SliderProps): preact.JSX.Element {
  return (
    <div class="flex flex-col gap-1">
      <div class="flex items-center justify-between">
        <label
          style={{
            color: 'var(--cp-muted)',
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '0.7rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </label>
        <span
          style={{
            color: 'var(--cp-cyan)',
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '0.7rem',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        class="cyber-slider"
        style={{ width: '100%' }}
        onInput={(e) => {
          const target = e.currentTarget
          onChange(Number(target.value))
        }}
      />
    </div>
  )
}
