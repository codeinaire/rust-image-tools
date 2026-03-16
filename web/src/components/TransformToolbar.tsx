import type { TransformName } from '../hooks/useConverter'

interface Props {
  transforms: TransformName[]
  onRotateCW: () => void
  onRotateCCW: () => void
  onToggleFlipH: () => void
  onToggleFlipV: () => void
  onToggleGrayscale: () => void
  onToggleInvert: () => void
  disabled: boolean
}

interface ToolbarButtonProps {
  label: string
  title: string
  active: boolean
  disabled: boolean
  onClick: () => void
  children: preact.ComponentChildren
}

/** A single toolbar icon button with active/disabled states. */
function ToolbarButton({
  label,
  title,
  active,
  disabled,
  onClick,
  children,
}: ToolbarButtonProps): preact.JSX.Element {
  const color = disabled ? 'var(--cp-muted)' : active ? 'var(--cp-yellow)' : 'var(--cp-cyan)'
  const glowFilter = active && !disabled ? 'drop-shadow(0 0 4px var(--cp-yellow-glow))' : 'none'

  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '2rem',
        height: '2rem',
        background: 'transparent',
        border: `1px solid ${active && !disabled ? 'var(--cp-yellow)' : 'var(--cp-border)'}`,
        color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        filter: glowFilter,
        transition: 'all 0.15s ease',
        padding: 0,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

/** Toolbar of image transform buttons (flip, rotate, grayscale, invert). */
export function TransformToolbar({
  transforms,
  onRotateCW,
  onRotateCCW,
  onToggleFlipH,
  onToggleFlipV,
  onToggleGrayscale,
  onToggleInvert,
  disabled,
}: Props): preact.JSX.Element {
  const hasFlipH = transforms.includes('flip_horizontal')
  const hasFlipV = transforms.includes('flip_vertical')
  const hasGrayscale = transforms.includes('grayscale')
  const hasInvert = transforms.includes('invert')
  const hasRotation = transforms.some(
    (t) => t === 'rotate_90' || t === 'rotate_180' || t === 'rotate_270',
  )

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.375rem 1rem',
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          color: 'var(--cp-muted)',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '0.65rem',
          letterSpacing: '0.12em',
          marginRight: '0.25rem',
          flexShrink: 0,
        }}
      >
        TRANSFORM
      </span>

      {/* Flip Horizontal */}
      <ToolbarButton
        label="Flip horizontal"
        title="Flip horizontal"
        active={hasFlipH}
        disabled={disabled}
        onClick={onToggleFlipH}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 3v18" />
          <path d="M16 7l4 5-4 5" />
          <path d="M8 7L4 12l4 5" />
        </svg>
      </ToolbarButton>

      {/* Flip Vertical */}
      <ToolbarButton
        label="Flip vertical"
        title="Flip vertical"
        active={hasFlipV}
        disabled={disabled}
        onClick={onToggleFlipV}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 12h18" />
          <path d="M7 8L12 4l5 4" />
          <path d="M7 16l5 4 5-4" />
        </svg>
      </ToolbarButton>

      {/* Separator */}
      <div
        style={{ width: '1px', height: '1.25rem', background: 'var(--cp-border)', flexShrink: 0 }}
      />

      {/* Rotate CW */}
      <ToolbarButton
        label="Rotate clockwise"
        title="Rotate 90 clockwise"
        active={hasRotation}
        disabled={disabled}
        onClick={onRotateCW}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 2v6h-6" />
          <path d="M21 8A9 9 0 1 0 6.2 6.2" />
        </svg>
      </ToolbarButton>

      {/* Rotate CCW */}
      <ToolbarButton
        label="Rotate counter-clockwise"
        title="Rotate 90 counter-clockwise"
        active={hasRotation}
        disabled={disabled}
        onClick={onRotateCCW}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 2v6h6" />
          <path d="M3 8a9 9 0 1 1 2.8-1.8" />
        </svg>
      </ToolbarButton>

      {/* Separator */}
      <div
        style={{ width: '1px', height: '1.25rem', background: 'var(--cp-border)', flexShrink: 0 }}
      />

      {/* Grayscale */}
      <ToolbarButton
        label="Grayscale"
        title="Convert to grayscale"
        active={hasGrayscale}
        disabled={disabled}
        onClick={onToggleGrayscale}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" />
        </svg>
      </ToolbarButton>

      {/* Invert */}
      <ToolbarButton
        label="Invert colors"
        title="Invert colors"
        active={hasInvert}
        disabled={disabled}
        onClick={onToggleInvert}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M7 12h10" />
          <path d="M12 7v10" />
        </svg>
      </ToolbarButton>
    </div>
  )
}
