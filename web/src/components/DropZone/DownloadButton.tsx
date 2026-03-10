import { useState } from 'preact/hooks'
import type { ConversionResult } from '../../hooks/useConverter'

interface Props {
  result: ConversionResult
  onDownloadClick: () => void
}

export function DownloadButton({ result, onDownloadClick }: Props): preact.JSX.Element {
  const [isHovered, setIsHovered] = useState(false)

  const background = isHovered ? '#00c8d4' : 'var(--cp-cyan)'

  return (
    <a
      id="download-link"
      href={result.blobUrl}
      download={result.filename}
      data-output-size={result.outputSize}
      onClick={onDownloadClick}
      onMouseEnter={() => {
        setIsHovered(true)
      }}
      onMouseLeave={() => {
        setIsHovered(false)
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        fontFamily: "'Orbitron', monospace",
        background,
        color: '#000',
        boxShadow: '0 0 20px var(--cp-cyan-glow)',
        letterSpacing: '0.15em',
        fontWeight: '700',
        fontSize: '0.875rem',
        textDecoration: 'none',
        transition: 'background 0.15s, box-shadow 0.2s',
        whiteSpace: 'nowrap',
        padding: '0 1.35rem',
      }}
    >
      <span class="hidden sm:inline">DOWNLOAD</span>
      <svg
        class="sm:hidden"
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 15V3" />
        <path d="M7 10l5 5 5-5" />
        <path d="M3 18h18v3H3z" />
      </svg>
    </a>
  )
}
