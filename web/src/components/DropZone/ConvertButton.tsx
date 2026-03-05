import { useState } from 'preact/hooks'

type Props = {
  convertDisabled: boolean
  onConvert: () => void
  controlsVisible: boolean
}

export function ConvertButton({ convertDisabled, onConvert, controlsVisible }: Props) {
  const [isHovered, setIsHovered] = useState(false)

  const background = convertDisabled
    ? 'var(--cp-yellow-bg-light)'
    : isHovered
      ? '#b8a000'
      : 'var(--cp-yellow)'

  return (
    <button
      id="convert-btn"
      disabled={convertDisabled}
      onClick={onConvert}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '100%',
        height: '100%',
        clipPath: controlsVisible ? 'inset(0 0 0 0%)' : 'inset(0 0 0 100%)',
        fontFamily: "'Orbitron', monospace",
        background,
        color: convertDisabled ? 'var(--cp-muted)' : '#000',
        border: 'none',
        boxShadow: convertDisabled ? 'none' : '0 0 20px var(--cp-yellow-glow-strong)',
        letterSpacing: '0.15em',
        fontWeight: '700',
        fontSize: '0.875rem',
        cursor: convertDisabled ? 'not-allowed' : 'pointer',
        transition:
          'clip-path 0.55s cubic-bezier(0.4, 0, 0.2, 1) 0.08s, background 0.15s, box-shadow 0.2s',
        whiteSpace: 'nowrap',
        padding: '0 1.35rem',
      }}
    >
      <span class="hidden sm:inline">EXECUTE</span>
      <svg
        class="sm:hidden"
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="none"
      >
        <polygon points="5,3 19,12 5,21" />
      </svg>
    </button>
  )
}
