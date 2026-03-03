import { useState, useRef, useEffect } from 'preact/hooks'
import { formatFileSize } from '../hooks/useConverter'
import type { FileInfo, ConversionResult, ConverterStatus } from '../hooks/useConverter'

type Props = {
  onFile: (file: File, inputMethod: 'file_picker' | 'drag_drop') => void
  fileInfo: FileInfo | null
  targetFormat: string
  onFormatChange: (fmt: string) => void
  onConvert: () => void
  convertDisabled: boolean
  status: ConverterStatus
  result: ConversionResult | null
  estimatedMs: number
  showProgress: boolean
  onDownloadClick: () => void
}

const CUT = 20
const FORMATS = ['png', 'jpeg', 'webp', 'gif', 'bmp']

function truncateMiddle(name: string, maxLen = 50): string {
  if (name.length <= maxLen) return name
  const half = Math.floor((maxLen - 1) / 2)
  return `${name.slice(0, half)}…${name.slice(-half)}`
}

export function DropZone({
  onFile,
  fileInfo,
  targetFormat,
  onFormatChange,
  onConvert,
  convertDisabled,
  status,
  result,
  estimatedMs,
  showProgress,
  onDownloadClick,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const [controlsVisible, setControlsVisible] = useState(false)
  const [hoveredFormat, setHoveredFormat] = useState<string | null>(null)
  const [isExecuteHovered, setIsExecuteHovered] = useState(false)
  const [isDownloadHovered, setIsDownloadHovered] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(() => {
      setDims({ w: el.offsetWidth, h: el.offsetHeight })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (fileInfo) {
      const id = requestAnimationFrame(() => setControlsVisible(true))
      return () => cancelAnimationFrame(id)
    } else {
      setControlsVisible(false)
    }
  }, [!!fileInfo])

  useEffect(() => {
    if (!barRef.current) return
    if (status === 'converting') {
      barRef.current.style.transition = 'width 0ms'
      barRef.current.style.width = '0%'
      const raf = requestAnimationFrame(() => {
        if (barRef.current) {
          barRef.current.style.transition = `width ${Math.round(estimatedMs * 0.9)}ms ease-out`
          barRef.current.style.width = '90%'
        }
      })
      return () => cancelAnimationFrame(raf)
    } else if (status === 'done') {
      barRef.current.style.transition = 'width 200ms ease-out'
      barRef.current.style.width = '100%'
    }
  }, [status, estimatedMs])

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer?.files[0]
    if (file) onFile(file, 'drag_drop')
  }

  function handleInputChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) onFile(file, 'file_picker')
  }

  const borderColor = isDragOver ? 'var(--cp-yellow)' : 'var(--cp-cyan)'

  const mainText = isDragOver
    ? '[ RELEASE TO UPLOAD ]'
    : fileInfo
      ? `[ ${truncateMiddle(fileInfo.file.name)} ]`
      : 'DRAG & DROP IMAGE — OR CLICK TO SELECT'

  const { w, h } = dims
  const points = w > 0 ? `${CUT},0 ${w},0 ${w},${h - CUT} ${w - CUT},${h} 0,${h} 0,${CUT}` : ''

  function fmtButtonStyle(fmt: string) {
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

  const isDone = status === 'done' && result !== null

  const sign = result && result.changePercent >= 0 ? '+' : ''
  const changeColor =
    result && result.changePercent <= 0 ? 'var(--cp-cyan)' : 'var(--cp-magenta, #ff3399)'

  const executeBackground = convertDisabled
    ? 'rgba(255,230,0,0.15)'
    : isExecuteHovered
      ? '#b8a000'
      : 'var(--cp-yellow)'

  const downloadBackground = isDownloadHovered ? '#00c8d4' : 'var(--cp-cyan)'

  return (
    <div
      ref={containerRef}
      id="drop-zone"
      style={{
        position: 'relative',
        background: isDragOver ? 'var(--cp-panel-light)' : 'var(--cp-panel)',
        transition: 'background 0.2s',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* SVG dashed/solid border */}
      {points && (
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            overflow: 'visible',
            pointerEvents: 'none',
          }}
        >
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <polygon
            points={points}
            fill="none"
            stroke={borderColor}
            stroke-width="2"
            stroke-dasharray={fileInfo ? '0' : '8 5'}
            filter="url(#glow)"
            style={{
              opacity: isHovered || isDragOver || fileInfo ? 1 : 0,
              transition: 'opacity 0.4s ease, stroke 0.2s',
            }}
          />
        </svg>
      )}

      {/* Top section: clickable file area */}
      <div
        style={{ padding: '2.5rem 2rem', textAlign: 'center', cursor: 'pointer' }}
        onClick={() => inputRef.current?.click()}
      >
        <p style={{ color: 'var(--cp-yellow)', fontSize: '1.125rem', letterSpacing: '0.05em' }}>
          {mainText}
        </p>
        {fileInfo ? (
          <>
            <p
              style={{
                color: 'var(--cp-muted)',
                fontSize: '0.8rem',
                marginTop: '0.5rem',
                letterSpacing: '0.1em',
              }}
            >
              {fileInfo.sourceFormat.toUpperCase()} — {fileInfo.width}×{fileInfo.height} —{' '}
              {formatFileSize(fileInfo.file.size)}
            </p>
            <p
              style={{
                color: 'var(--cp-cyan-glow-strong)',
                fontSize: '0.75rem',
                marginTop: '0.4rem',
                letterSpacing: '0.1em',
              }}
            >
              click to change
            </p>
          </>
        ) : (
          <p
            style={{
              color: 'var(--cp-text)',
              fontSize: '0.8rem',
              marginTop: '0.5rem',
              letterSpacing: '0.1em',
            }}
          >
            PNG · JPEG · WEBP · GIF · BMP — UP TO 200 MB
          </p>
        )}
        <input
          ref={inputRef}
          id="file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
          class="hidden"
          onChange={handleInputChange}
        />
      </div>

      {/* Bottom controls */}
      {fileInfo && (
        <div>
          {/* Thin progress bar — above the dividing line */}
          <div
            style={{
              height: '2px',
              background: 'rgba(255,230,0,0.12)',
              opacity: showProgress ? 1 : 0,
              transition: 'opacity 0.3s',
            }}
          >
            <div
              ref={barRef}
              style={{
                height: '2px',
                width: '0%',
                background: 'var(--cp-yellow)',
                boxShadow: '0 0 8px var(--cp-yellow-glow), 0 0 16px var(--cp-yellow-glow-strong)',
                transition: 'width 0ms ease-out',
              }}
            />
          </div>

          {/* Dividing line + controls row */}
          <div style={{ borderTop: '1px solid var(--cp-cyan)' }} />
          <div style={{ display: 'flex', height: '3rem', overflow: 'hidden' }}>
            {/* Left: format buttons or metadata stats */}
            {isDone && result ? (
              <div
                style={{
                  flex: 1,
                  borderRight: '1px solid var(--cp-cyan)',
                  display: 'flex',
                  alignItems: 'stretch',
                }}
              >
                {/* Size stat */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 0.25rem',
                    borderRight: '1px solid rgba(0,245,255,0.2)',
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
                    borderRight: '1px solid rgba(0,245,255,0.2)',
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
            ) : (
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
                {FORMATS.map((fmt, i) => (
                  <>
                    {i > 0 && (
                      <div
                        key={`sep-${fmt}`}
                        style={{
                          width: '1px',
                          background: 'var(--cp-cyan)',
                          opacity: 0.25,
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <button
                      key={fmt}
                      onClick={() => onFormatChange(fmt)}
                      onMouseEnter={() => setHoveredFormat(fmt)}
                      onMouseLeave={() => setHoveredFormat(null)}
                      style={fmtButtonStyle(fmt)}
                    >
                      {fmt.toUpperCase()}
                    </button>
                  </>
                ))}
              </div>
            )}

            {/* Right: download or execute */}
            <div
              style={{
                flex: 1,
                clipPath: `polygon(0% 0%, 100% 0%, 100% calc(100% - ${CUT}px), calc(100% - ${CUT}px) 100%, 0% 100%)`,
              }}
            >
              {isDone && result ? (
                <a
                  href={result.blobUrl}
                  download={result.filename}
                  onClick={onDownloadClick}
                  onMouseEnter={() => setIsDownloadHovered(true)}
                  onMouseLeave={() => setIsDownloadHovered(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                    fontFamily: "'Orbitron', monospace",
                    background: downloadBackground,
                    color: '#000',
                    boxShadow: '0 0 20px var(--cp-cyan-glow)',
                    letterSpacing: '0.15em',
                    fontWeight: '700',
                    fontSize: '0.875rem',
                    textDecoration: 'none',
                    transition: 'background 0.15s, box-shadow 0.2s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  DOWNLOAD
                </a>
              ) : (
                <button
                  disabled={convertDisabled}
                  onClick={onConvert}
                  onMouseEnter={() => setIsExecuteHovered(true)}
                  onMouseLeave={() => setIsExecuteHovered(false)}
                  style={{
                    width: '100%',
                    height: '100%',
                    clipPath: controlsVisible ? 'inset(0 0 0 0%)' : 'inset(0 0 0 100%)',
                    fontFamily: "'Orbitron', monospace",
                    background: executeBackground,
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
                  }}
                >
                  EXECUTE
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
