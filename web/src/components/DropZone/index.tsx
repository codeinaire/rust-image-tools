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
        <p style={{ color: 'var(--cp-yellow)', fontSize: '1.125rem', letterSpacing: '0.05em' }}>
          {mainText}
        </p>
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
        ) : (
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
        )}
        <input
          ref={inputRef}
          id="file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/tiff,image/x-icon,image/qoi"
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
            {/* Left: format buttons or result stats */}
            {isDone && result ? (
              <ResultStats result={result} />
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
              class="w-fit sm:w-[35%]"
              style={{
                flexShrink: 0,
                clipPath: `polygon(0% 0%, 100% 0%, 100% calc(100% - ${CUT}px), calc(100% - ${CUT}px) 100%, 0% 100%)`,
              }}
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
