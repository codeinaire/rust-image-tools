import { useState, useEffect, useRef } from 'preact/hooks'
import { createPortal } from 'preact/compat'
import { formatFileSize } from '../hooks/useConverter'
import type { FileInfo, ConversionResult, TransformName } from '../hooks/useConverter'

interface Props {
  fileInfo: FileInfo
  result: ConversionResult | null
  transforms: TransformName[]
  onRotateCW: () => void
  onRotateCCW: () => void
  onToggleFlipH: () => void
  onToggleFlipV: () => void
  onToggleGrayscale: () => void
  onToggleInvert: () => void
  disabled: boolean
  onClose: () => void
  onDownloadClick: () => void
  onUndo: () => void
  canUndo: boolean
}

interface SideButtonProps {
  label: string
  active: boolean
  disabled: boolean
  onClick: () => void
  children: preact.ComponentChildren
}

const MONO = "'Share Tech Mono', monospace"
/** Height of the header row (label + close button + margin), used to align the tools sidebar. */
const HEADER_ROW_HEIGHT = '40px'

/**
 * Creates an object URL from a File, revoking the previous one on change.
 */
function useObjectUrl(file: File | null): string | null {
  const urlRef = useRef<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    if (!file) {
      setUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(file)
    urlRef.current = objectUrl
    setUrl(objectUrl)
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
    }
  }, [file])

  return url
}

/** Vertical sidebar transform button. */
function SideButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: SideButtonProps): preact.JSX.Element {
  const color = disabled ? 'var(--cp-muted)' : active ? 'var(--cp-yellow)' : 'var(--cp-cyan)'
  const borderColor = active && !disabled ? 'var(--cp-yellow)' : 'var(--cp-border)'
  const glow = active && !disabled ? 'drop-shadow(0 0 4px var(--cp-yellow-glow))' : 'none'

  return (
    <div class="cyber-tooltip" style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '2.5rem',
          height: '2.5rem',
          background: 'transparent',
          border: `1px solid ${borderColor}`,
          color,
          cursor: disabled ? 'not-allowed' : 'pointer',
          filter: glow,
          transition: 'all 0.15s ease',
          padding: 0,
        }}
      >
        {children}
      </button>
      <span class="cyber-tooltip-text cyber-tooltip-text--center">{label}</span>
    </div>
  )
}

/** Full-screen modal for image transforms with vertical toolbar and preview. */
export function TransformModal({
  fileInfo,
  result,
  transforms,
  onRotateCW,
  onRotateCCW,
  onToggleFlipH,
  onToggleFlipV,
  onToggleGrayscale,
  onToggleInvert,
  disabled,
  onClose,
  onDownloadClick,
  onUndo,
  canUndo,
}: Props): preact.JSX.Element {
  const sourceUrl = useObjectUrl(fileInfo.file)
  const [closeHovered, setCloseHovered] = useState(false)
  const [dlHovered, setDlHovered] = useState(false)

  const hasFlipH = transforms.includes('flip_horizontal')
  const hasFlipV = transforms.includes('flip_vertical')
  const hasGrayscale = transforms.includes('grayscale')
  const hasInvert = transforms.includes('invert')

  const activeCount = transforms.length

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const displayUrl = result ? result.blobUrl : sourceUrl

  const modal = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          maxWidth: '90vw',
          maxHeight: '85vh',
          background: 'var(--cp-panel)',
          border: '1px solid var(--cp-cyan)',
          boxShadow: '0 0 30px var(--cp-cyan-glow), 0 0 60px var(--cp-cyan-glow-subtle)',
          padding: '1.25rem',
        }}
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        {/* Left: vertical transform buttons */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            marginTop: HEADER_ROW_HEIGHT,
          }}
        >
          {/* TOOLS header — aligned with the header row */}
          <div
            style={{
              color: 'var(--cp-cyan)',
              fontFamily: MONO,
              fontSize: '0.7rem',
              letterSpacing: '0.12em',
              textAlign: 'center',
              marginBottom: '0.75rem',
            }}
          >
            TOOLS
          </div>

          {/* Buttons — equally spaced */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.375rem',
            }}
          >
            <SideButton
              label="Flip horizontal"
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
            </SideButton>

            <SideButton
              label="Flip vertical"
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
            </SideButton>

            <SideButton
              label="Grayscale"
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
            </SideButton>

            <SideButton
              label="Invert colors"
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
            </SideButton>

            <div
              style={{ width: '100%', height: '1px', background: 'var(--cp-border)', margin: 0 }}
            />

            <SideButton
              label="Rotate clockwise"
              active={false}
              disabled={disabled}
              onClick={onRotateCW}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M15 4l3 3-3 3" />
                <path d="M18 7h-5a5 5 0 0 0-5 5v0a5 5 0 0 0 5 5h1" />
              </svg>
            </SideButton>

            <SideButton
              label="Rotate counter-clockwise"
              active={false}
              disabled={disabled}
              onClick={onRotateCCW}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9 4l-3 3 3 3" />
                <path d="M6 7h5a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5h-1" />
              </svg>
            </SideButton>

            <div
              style={{ width: '100%', height: '1px', background: 'var(--cp-border)', margin: 0 }}
            />

            <SideButton label="Undo" active={false} disabled={!canUndo} onClick={onUndo}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M3 10h10a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H7" />
                <path d="M7 6l-4 4 4 4" />
              </svg>
            </SideButton>
          </div>
        </div>

        {/* Right: image preview area */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            flex: 1,
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem',
            }}
          >
            <span
              style={{
                color: 'var(--cp-cyan)',
                fontFamily: MONO,
                fontSize: '0.7rem',
                letterSpacing: '0.12em',
              }}
            >
              // TRANSFORM IMAGE
              {activeCount > 0 && (
                <span style={{ color: 'var(--cp-yellow)', marginLeft: '0.5rem' }}>
                  [{activeCount} ACTIVE]
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close transform modal"
              onMouseEnter={() => {
                setCloseHovered(true)
              }}
              onMouseLeave={() => {
                setCloseHovered(false)
              }}
              style={{
                background: closeHovered ? 'var(--cp-magenta)' : 'transparent',
                border: '1px solid var(--cp-magenta)',
                color: closeHovered ? '#000' : 'var(--cp-magenta)',
                fontFamily: "'Orbitron', monospace",
                fontSize: '0.7rem',
                letterSpacing: '0.12em',
                fontWeight: '700',
                padding: '0.3rem 0.75rem',
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              CLOSE
            </button>
          </div>

          {/* Image */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 0,
              background: 'var(--cp-shadow-soft)',
              border: '1px solid var(--cp-border)',
              padding: '0.5rem',
              position: 'relative',
            }}
          >
            {displayUrl && (
              <img
                src={displayUrl}
                alt="Transform preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  display: 'block',
                  opacity: disabled ? 0.4 : 1,
                  transition: 'opacity 0.2s',
                }}
              />
            )}

            {/* Loading overlay */}
            {disabled && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                }}
              >
                {/* Rotating diamond */}
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="none"
                  style={{
                    animation: 'cp-spin 1.4s linear infinite',
                    filter:
                      'drop-shadow(0 0 6px var(--cp-cyan)) drop-shadow(0 0 14px var(--cp-cyan-glow))',
                  }}
                >
                  <polygon
                    points="16,2 30,16 16,30 2,16"
                    stroke="var(--cp-cyan)"
                    stroke-width="1.5"
                  />
                  <polygon
                    points="16,8 24,16 16,24 8,16"
                    stroke="var(--cp-cyan)"
                    stroke-width="1"
                    stroke-opacity="0.35"
                  />
                  <circle cx="16" cy="16" r="2" fill="var(--cp-cyan)" />
                </svg>
                <span
                  style={{
                    color: 'var(--cp-cyan)',
                    fontFamily: MONO,
                    fontSize: '0.7rem',
                    letterSpacing: '0.12em',
                    animation: 'cp-glow-pulse 1.4s ease-in-out infinite',
                  }}
                >
                  PROCESSING...
                </span>
                {/* Scan bar */}
                <div
                  style={{
                    width: '8rem',
                    height: '2px',
                    background: 'var(--cp-border)',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '25%',
                      background:
                        'linear-gradient(90deg, transparent, var(--cp-cyan), transparent)',
                      animation: 'cp-scan 1.4s ease-in-out infinite',
                      boxShadow: '0 0 8px var(--cp-cyan-glow-strong)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bottom bar: meta info + download */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '0.5rem',
            }}
          >
            <div
              style={{
                color: 'var(--cp-text)',
                fontFamily: MONO,
                fontSize: '0.6rem',
                letterSpacing: '0.08em',
              }}
            >
              <span>
                {fileInfo.sourceFormat.toUpperCase()} — {fileInfo.width}x{fileInfo.height} —{' '}
                {formatFileSize(fileInfo.file.size)}
              </span>
              {result && (
                <span style={{ color: 'var(--cp-cyan)', marginLeft: '1rem' }}>
                  OUTPUT: {result.extension.toUpperCase()} — {formatFileSize(result.outputSize)}
                </span>
              )}
            </div>

            {result && (
              <a
                href={result.blobUrl}
                download={result.filename}
                onClick={onDownloadClick}
                onMouseEnter={() => {
                  setDlHovered(true)
                }}
                onMouseLeave={() => {
                  setDlHovered(false)
                }}
                style={{
                  background: dlHovered ? 'var(--cp-cyan)' : 'transparent',
                  border: '1px solid var(--cp-cyan)',
                  color: dlHovered ? '#000' : 'var(--cp-cyan)',
                  fontFamily: "'Orbitron', monospace",
                  fontSize: '0.7rem',
                  letterSpacing: '0.12em',
                  fontWeight: '700',
                  padding: '0.3rem 1rem',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                  flexShrink: 0,
                }}
              >
                DOWNLOAD
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body) as unknown as preact.JSX.Element
}
