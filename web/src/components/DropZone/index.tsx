import { useState, useRef, useEffect } from 'preact/hooks'
import { formatFileSize } from '../../hooks/useConverter'
import type { FileInfo, ConversionResult, ConverterStatus } from '../../hooks/useConverter'
import { ValidFormat } from '../../types'
import { FormatSelector } from './FormatSelector'
import { ConvertButton } from './ConvertButton'
import { DownloadButton } from './DownloadButton'
import { ResultStats } from './ResultStats'

type Props = {
  onFile: (file: File, inputMethod: 'file_picker' | 'drag_drop') => void
  fileInfo: FileInfo | null
  targetFormat: ValidFormat
  onFormatChange: (fmt: ValidFormat) => void
  onConvert: () => void
  convertDisabled: boolean
  status: ConverterStatus
  result: ConversionResult | null
  estimatedMs: number
  showProgress: boolean
  onDownloadClick: () => void
  /** Optional hint format to display when no file is loaded (e.g. 'heic' on HEIC landing pages). */
  initialFormat?: ValidFormat | 'heic' | undefined
  /** Source format for the page (set on conversion landing pages). */
  pageFromFormat?: string
  /** Target format for the page (set on conversion landing pages). */
  pageToFormat?: ValidFormat
}

const CUT = 20

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
  initialFormat,
  pageFromFormat,
  pageToFormat,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const [controlsVisible, setControlsVisible] = useState(false)

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
  }, [fileInfo])

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
    if (!(e.target instanceof HTMLInputElement)) return
    const file = e.target.files?.[0]
    if (file) onFile(file, 'file_picker')
  }

  const borderColor = isDragOver ? 'var(--cp-yellow)' : 'var(--cp-cyan)'

  const isReading = status === 'reading'

  const mainText = isDragOver
    ? '[ RELEASE TO UPLOAD ]'
    : isReading
      ? '[ DECODING... ]'
      : fileInfo
        ? `[ ${truncateMiddle(fileInfo.file.name)} ]`
        : 'DRAG & DROP IMAGE — OR CLICK TO SELECT'

  const { w, h } = dims
  const points = w > 0 ? `${CUT},0 ${w},0 ${w},${h - CUT} ${w - CUT},${h} 0,${h} 0,${CUT}` : ''

  const isDone = status === 'done' && result !== null

  return (
    <div
      ref={containerRef}
      id="drop-zone"
      style={{
        position: 'relative',
        background: isDragOver ? 'var(--cp-panel-light)' : 'var(--cp-panel)',
        transition: 'background 0.2s',
        clipPath: `polygon(${CUT}px 0, 100% 0, 100% calc(100% - ${CUT}px), calc(100% - ${CUT}px) 100%, 0 100%, 0 ${CUT}px)`,
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
        {isReading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            {/* Rotating diamond with glow */}
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              style={{
                animation: 'cp-spin 1.4s linear infinite',
                filter: 'drop-shadow(0 0 6px var(--cp-cyan)) drop-shadow(0 0 14px var(--cp-cyan-glow))',
              }}
            >
              <polygon points="16,2 30,16 16,30 2,16" stroke="var(--cp-cyan)" stroke-width="1.5" />
              <polygon points="16,8 24,16 16,24 8,16" stroke="var(--cp-cyan)" stroke-width="1" stroke-opacity="0.35" />
              <circle cx="16" cy="16" r="2" fill="var(--cp-cyan)" />
            </svg>
            {/* Glowing pulsing text */}
            <p style={{ color: 'var(--cp-cyan)', fontSize: '1.125rem', letterSpacing: '0.12em', animation: 'cp-glow-pulse 1.4s ease-in-out infinite' }}>
              {mainText}
            </p>
            {/* Sweep scan bar */}
            <div style={{ width: '10rem', height: '2px', background: 'var(--cp-border)', overflow: 'hidden', position: 'relative' }}>
              <div style={{
                position: 'absolute',
                inset: 0,
                width: '25%',
                background: 'linear-gradient(90deg, transparent, var(--cp-cyan), transparent)',
                animation: 'cp-scan 1.4s ease-in-out infinite',
                boxShadow: '0 0 8px var(--cp-cyan-glow-strong)',
              }} />
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--cp-yellow)', fontSize: '1.125rem', letterSpacing: '0.05em' }}>
            {mainText}
          </p>
        )}
        {fileInfo ? (
          <>
            <p
              id="source-info"
              style={{
                color: 'var(--cp-muted)',
                fontSize: '0.8rem',
                marginTop: '0.5rem',
                letterSpacing: '0.1em',
              }}
            >
              <span id="source-details">
                {fileInfo.sourceFormat.toUpperCase()} — {fileInfo.width}×{fileInfo.height} —{' '}
                {formatFileSize(fileInfo.file.size)}
              </span>
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
        ) : pageFromFormat && pageToFormat ? (
          <p
            style={{
              color: 'var(--cp-text)',
              fontSize: '0.8rem',
              marginTop: '0.5rem',
              letterSpacing: '0.1em',
            }}
          >
            {pageFromFormat.toUpperCase()} TO {pageToFormat.toUpperCase()} — UP TO 200 MB
          </p>
        ) : (
          <>
            <p
              style={{
                color: 'var(--cp-text)',
                fontSize: '0.8rem',
                marginTop: '0.5rem',
                letterSpacing: '0.1em',
              }}
            >
              PNG · JPEG · WEBP · GIF · BMP · TIFF · ICO · QOI — UP TO 200 MB
            </p>
            <p
              style={{
                color: 'var(--cp-muted)',
                fontSize: '0.7rem',
                marginTop: '0.25rem',
                letterSpacing: '0.1em',
              }}
            >
              HEIC/HEIF accepted as input only
            </p>
          </>
        )}
        <input
          ref={inputRef}
          id="file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/tiff,image/x-icon,image/qoi,image/heic,image/heif,.heic,.heif"
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
              background: 'var(--cp-yellow-bg-medium)',
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
            {/* Left: format buttons or result stats */}
            {isDone && result ? (
              <ResultStats result={result} />
            ) : pageToFormat ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  clipPath: controlsVisible ? 'inset(0 0% 0 0)' : 'inset(0 100% 0 0)',
                  transition: 'clip-path 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: 'var(--cp-yellow-bg-dim)',
                  borderRight: '1px solid var(--cp-cyan)',
                }}
              >
                <span
                  style={{
                    color: 'var(--cp-yellow)',
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '0.7rem',
                    letterSpacing: '0.12em',
                  }}
                >
                  {pageToFormat.toUpperCase()}
                </span>
              </div>
            ) : (
              <FormatSelector
                targetFormat={targetFormat}
                onFormatChange={onFormatChange}
                controlsVisible={controlsVisible}
                status={status}
              />
            )}

            {/* Right: download or execute */}
            <div
              style={{
                flex: pageToFormat && !isDone ? 1 : undefined,
                flexShrink: 0,
                clipPath: `polygon(0% 0%, 100% 0%, 100% calc(100% - ${CUT}px), calc(100% - ${CUT}px) 100%, 0% 100%)`,
              }}
              class={pageToFormat && !isDone ? undefined : 'w-fit sm:w-[35%]'}
            >
              {isDone && result ? (
                <DownloadButton result={result} onDownloadClick={onDownloadClick} />
              ) : (
                <ConvertButton
                  convertDisabled={convertDisabled}
                  onConvert={onConvert}
                  controlsVisible={controlsVisible}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
