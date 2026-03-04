import { useState, useRef, useEffect } from 'preact/hooks'
import { createPortal, Fragment } from 'preact/compat'
import { ValidFormat } from '../../types'
import type { ConverterStatus } from '../../hooks/useConverter'

type Props = {
  targetFormat: ValidFormat
  onFormatChange: (fmt: ValidFormat) => void
  controlsVisible: boolean
  status: ConverterStatus
}

const TOP_FORMATS: ValidFormat[] = [ValidFormat.Png, ValidFormat.Jpeg, ValidFormat.WebP, ValidFormat.Gif]
const MORE_FORMATS: ValidFormat[] = [ValidFormat.Bmp, ValidFormat.Qoi, ValidFormat.Ico, ValidFormat.Tiff, ValidFormat.Tga]

export function FormatSelector({ targetFormat, onFormatChange, controlsVisible, status }: Props) {
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const moreDropdownRef = useRef<HTMLDivElement>(null)
  const [morePos, setMorePos] = useState({ bottom: 0, left: 0 })
  const [hoveredFormat, setHoveredFormat] = useState<ValidFormat | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    if (!moreOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (
        moreButtonRef.current?.contains(e.target as Node) ||
        moreDropdownRef.current?.contains(e.target as Node)
      )
        return
      setMoreOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [moreOpen])

  useEffect(() => {
    setMoreOpen(false)
  }, [status])

  function fmtButtonStyle(fmt: ValidFormat) {
    const isSelected = fmt === targetFormat
    const isHov = hoveredFormat === fmt && !isSelected
    return {
      flex: 1,
      height: '100%',
      border: 'none',
      background: isSelected
        ? 'rgba(255,230,0,0.1)'
        : isHov
          ? 'rgba(0,245,255,0.08)'
          : 'transparent',
      color: isSelected ? 'var(--cp-yellow)' : isHov ? 'var(--cp-cyan)' : 'var(--cp-muted)',
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '0.7rem',
      letterSpacing: '0.12em',
      cursor: 'pointer',
      transition: 'background 0.15s, color 0.15s',
    }
  }

  const isMoreSelected = MORE_FORMATS.includes(targetFormat)

  return (
    <>
      <div
        style={{
          flex: 1,
          clipPath: controlsVisible ? 'inset(0 0% 0 0)' : 'inset(0 100% 0 0)',
          transition: 'clip-path 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
          background: 'rgba(0, 245, 255, 0.03)',
          borderRight: '1px solid var(--cp-cyan)',
          display: 'flex',
        }}
      >
        {TOP_FORMATS.map((fmt, i) => (
          <Fragment key={fmt}>
            {i > 0 && (
              <div
                style={{
                  width: '1px',
                  background: 'var(--cp-cyan)',
                  opacity: 0.25,
                  flexShrink: 0,
                }}
              />
            )}
            <button
              data-format={fmt}
              onClick={() => onFormatChange(fmt)}
              onMouseEnter={() => setHoveredFormat(fmt)}
              onMouseLeave={() => setHoveredFormat(null)}
              style={fmtButtonStyle(fmt)}
            >
              {fmt.toUpperCase()}
            </button>
          </Fragment>
        ))}
        <div
          style={{
            width: '1px',
            background: 'var(--cp-cyan)',
            opacity: 0.25,
            flexShrink: 0,
          }}
        />
        <button
          ref={moreButtonRef}
          onClick={() => {
            if (moreButtonRef.current) {
              const rect = moreButtonRef.current.getBoundingClientRect()
              setMorePos({ bottom: window.innerHeight - rect.top + 4, left: rect.left })
            }
            setMoreOpen((o) => !o)
          }}
          style={{
            flex: '0 0 auto',
            height: '100%',
            padding: '0 0.6rem',
            border: 'none',
            background: isMoreSelected
              ? 'rgba(255,230,0,0.1)'
              : moreOpen
                ? 'rgba(0,245,255,0.08)'
                : 'transparent',
            color: isMoreSelected
              ? 'var(--cp-yellow)'
              : moreOpen
                ? 'var(--cp-cyan)'
                : 'var(--cp-muted)',
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '0.7rem',
            letterSpacing: '0.12em',
            cursor: 'pointer',
            transition: 'background 0.15s, color 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          {isMoreSelected ? targetFormat.toUpperCase() : '···'}
        </button>
      </div>

      {moreOpen &&
        createPortal(
          <div
            ref={moreDropdownRef}
            style={{
              position: 'fixed',
              bottom: `${morePos.bottom}px`,
              left: `${morePos.left}px`,
              background: 'var(--cp-panel)',
              border: '1px solid var(--cp-cyan)',
              boxShadow: '0 0 20px var(--cp-cyan-glow-subtle), 0 4px 24px rgba(0,0,0,0.6)',
              zIndex: 1000,
            }}
          >
            {MORE_FORMATS.map((fmt) => {
              const isSelected = fmt === targetFormat
              const isHov = hoveredFormat === fmt && !isSelected
              return (
                <div
                  key={fmt}
                  onClick={() => {
                    onFormatChange(fmt)
                    setMoreOpen(false)
                  }}
                  onMouseEnter={() => setHoveredFormat(fmt)}
                  onMouseLeave={() => setHoveredFormat(null)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    fontFamily: "'Share Tech Mono', monospace",
                    letterSpacing: '0.1em',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    color: isSelected ? 'var(--cp-yellow)' : isHov ? 'var(--cp-cyan)' : 'var(--cp-text)',
                    background: isSelected ? 'rgba(255,230,0,0.06)' : isHov ? 'rgba(0,245,255,0.06)' : 'transparent',
                    borderLeft: isSelected ? '2px solid var(--cp-yellow)' : '2px solid transparent',
                    whiteSpace: 'nowrap',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {fmt.toUpperCase()}
                </div>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}
