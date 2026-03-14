import { useState } from 'preact/hooks'
import { ValidFormat } from '../types'
import { formatFileSize } from '../hooks/useConverter'
import type { BenchmarkState, BenchmarkEntry, BenchmarkFormatResult } from '../hooks/useBenchmark'
import type { FileInfo } from '../hooks/useConverter'

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
  tiff: 'image/tiff',
  ico: 'image/x-icon',
  tga: 'image/x-tga',
  qoi: 'image/qoi',
}

interface Props {
  fileInfo: FileInfo | null
  benchmarkState: BenchmarkState
  onStartBenchmark: () => void
  disabled: boolean
}

const ALL_FORMATS: ValidFormat[] = Object.values(ValidFormat)

const MONO_FONT = "'Share Tech Mono', monospace"

/** Formats a time value as a human-readable string. */
function formatTime(ms: number): string {
  if (ms < 1000) {
    return `${ms} ms`
  }
  return `${(ms / 1000).toFixed(1)} s`
}

/** Finds the entry with the smallest output size among successful results. */
function findSmallestFormat(results: BenchmarkEntry[]): ValidFormat | null {
  let smallest: ValidFormat | null = null
  let smallestSize = Infinity

  for (const entry of results) {
    if (entry.success && entry.outputSize < smallestSize) {
      smallestSize = entry.outputSize
      smallest = entry.format
    }
  }

  return smallest
}

/** Triggers a browser download for the given benchmark result. */
function downloadBenchmarkResult(entry: BenchmarkFormatResult, baseName: string): void {
  const extension = entry.format === ValidFormat.Jpeg ? 'jpg' : entry.format
  const filename = `${baseName}.${extension}`
  const mimeType = MIME_TYPES[entry.format] ?? 'application/octet-stream'
  const blob = new Blob([entry.data.buffer as ArrayBuffer], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Format size comparison benchmark table with live-updating results. */
export function BenchmarkTable({
  fileInfo,
  benchmarkState,
  onStartBenchmark,
  disabled,
}: Props): preact.JSX.Element | null {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null)

  /** Derives the base filename (without extension) from the uploaded file. */
  const baseName = fileInfo ? fileInfo.file.name.replace(/\.[^.]+$/, '') : ''

  if (!fileInfo) {
    return null
  }

  const hasResults = benchmarkState.totalFormats > 0
  const isComplete = !benchmarkState.isRunning && hasResults

  if (!hasResults) {
    return (
      <div style={{ marginTop: '1rem', textAlign: 'center' }}>
        <CompareButton
          disabled={disabled}
          onClick={onStartBenchmark}
          isHovered={hoveredButton === 'compare'}
          onMouseEnter={() => {
            setHoveredButton('compare')
          }}
          onMouseLeave={() => {
            setHoveredButton(null)
          }}
        />
      </div>
    )
  }

  const formats = ALL_FORMATS.filter((f) => f !== fileInfo.sourceFormat)
  const resultMap = new Map<ValidFormat, BenchmarkEntry>()
  for (const entry of benchmarkState.results) {
    resultMap.set(entry.format, entry)
  }

  const smallestFormat = isComplete ? findSmallestFormat(benchmarkState.results) : null

  return (
    <div style={{ marginTop: '1rem' }}>
      {/* Progress indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.5rem',
          padding: '0 0.25rem',
        }}
      >
        <span
          style={{
            color: benchmarkState.isRunning ? 'var(--cp-yellow)' : 'var(--cp-cyan)',
            fontFamily: MONO_FONT,
            fontSize: '0.7rem',
            letterSpacing: '0.1em',
          }}
        >
          {benchmarkState.isRunning
            ? `ANALYZING ${benchmarkState.completedFormats} / ${benchmarkState.totalFormats} FORMATS...`
            : 'FORMAT COMPARISON COMPLETE'}
        </span>
        {benchmarkState.isRunning && (
          <div
            style={{
              width: '4rem',
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
                background: 'linear-gradient(90deg, transparent, var(--cp-yellow), transparent)',
                animation: 'cp-scan 1.4s ease-in-out infinite',
              }}
            />
          </div>
        )}
      </div>

      {/* Table */}
      <div
        style={{
          border: '1px solid var(--cp-cyan)',
          boxShadow: '0 0 8px var(--cp-cyan-glow-subtle)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '4.5rem 1fr 4rem 4rem 3.5rem',
            borderBottom: '1px solid var(--cp-cyan)',
            background: 'var(--cp-cyan-bg-faint)',
          }}
        >
          {['FORMAT', 'SIZE', 'DELTA', 'TIME', ''].map((header, i) => (
            <div
              key={header || 'action'}
              style={{
                padding: '0.4rem 0.5rem',
                color: 'var(--cp-muted)',
                fontFamily: MONO_FONT,
                fontSize: '0.55rem',
                letterSpacing: '0.1em',
                ...(i < 4 ? { borderRight: '1px solid var(--cp-cyan-glow-soft)' } : {}),
              }}
            >
              {header}
            </div>
          ))}
        </div>

        {/* Rows */}
        {formats.map((format, index) => {
          const entry = resultMap.get(format)
          const isSmallest = smallestFormat === format
          const isLast = index === formats.length - 1

          return (
            <BenchmarkRow
              key={format}
              format={format}
              entry={entry}
              isSmallest={isSmallest}
              isLast={isLast}
              baseName={baseName}
              hoveredButton={hoveredButton}
              onHoverButton={setHoveredButton}
            />
          )
        })}
      </div>
    </div>
  )
}

interface CompareButtonProps {
  disabled: boolean
  onClick: () => void
  isHovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
}

/** The "Compare all formats" trigger button shown before benchmarking. */
function CompareButton({
  disabled,
  onClick,
  isHovered,
  onMouseEnter,
  onMouseLeave,
}: CompareButtonProps): preact.JSX.Element {
  const background = disabled ? 'transparent' : isHovered ? 'var(--cp-cyan-bg-dim)' : 'transparent'
  const color = disabled ? 'var(--cp-muted)' : isHovered ? 'var(--cp-cyan)' : 'var(--cp-text)'

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        background,
        color,
        border: `1px solid ${disabled ? 'var(--cp-border)' : 'var(--cp-cyan)'}`,
        fontFamily: MONO_FONT,
        fontSize: '0.7rem',
        letterSpacing: '0.1em',
        padding: '0.5rem 1.25rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      COMPARE ALL FORMATS
    </button>
  )
}

interface BenchmarkRowProps {
  format: ValidFormat
  entry: BenchmarkEntry | undefined
  isSmallest: boolean
  isLast: boolean
  baseName: string
  hoveredButton: string | null
  onHoverButton: (key: string | null) => void
}

/** A single row in the benchmark table, showing either results, an error, or a skeleton. */
function BenchmarkRow({
  format,
  entry,
  isSmallest,
  isLast,
  baseName,
  hoveredButton,
  onHoverButton,
}: BenchmarkRowProps): preact.JSX.Element {
  const rowBackground = isSmallest ? 'var(--cp-cyan-bg-faint)' : 'transparent'
  const borderBottom = isLast ? 'none' : '1px solid var(--cp-border)'
  const buttonKey = `use-${format}`
  const isButtonHovered = hoveredButton === buttonKey

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '4.5rem 1fr 4rem 4rem 3.5rem',
        borderBottom,
        background: rowBackground,
        transition: 'background 0.2s',
      }}
    >
      {/* Format name */}
      <div
        style={{
          padding: '0.35rem 0.5rem',
          fontFamily: MONO_FONT,
          fontSize: '0.7rem',
          letterSpacing: '0.08em',
          color: isSmallest ? 'var(--cp-cyan)' : 'var(--cp-yellow)',
          borderRight: '1px solid var(--cp-cyan-glow-soft)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {format.toUpperCase()}
        {isSmallest && (
          <span
            style={{
              marginLeft: '0.25rem',
              fontSize: '0.55rem',
              color: 'var(--cp-cyan)',
            }}
            title="Smallest output"
          >
            *
          </span>
        )}
      </div>

      {/* Size */}
      <div
        style={{
          padding: '0.35rem 0.5rem',
          fontFamily: MONO_FONT,
          fontSize: '0.65rem',
          color: 'var(--cp-text)',
          borderRight: '1px solid var(--cp-cyan-glow-soft)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {entry === undefined ? (
          <SkeletonBar />
        ) : entry.success ? (
          formatFileSize(entry.outputSize)
        ) : (
          <span style={{ color: 'var(--cp-magenta, #ff3399)', fontSize: '0.6rem' }}>FAILED</span>
        )}
      </div>

      {/* Delta */}
      <div
        style={{
          padding: '0.35rem 0.5rem',
          fontFamily: MONO_FONT,
          fontSize: '0.65rem',
          borderRight: '1px solid var(--cp-cyan-glow-soft)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {entry === undefined ? (
          <SkeletonBar />
        ) : entry.success ? (
          <span
            style={{
              color: entry.changePercent <= 0 ? 'var(--cp-cyan)' : 'var(--cp-magenta, #ff3399)',
            }}
          >
            {entry.changePercent >= 0 ? '+' : ''}
            {entry.changePercent.toFixed(0)}%
          </span>
        ) : (
          <span style={{ color: 'var(--cp-muted)' }}>--</span>
        )}
      </div>

      {/* Time */}
      <div
        style={{
          padding: '0.35rem 0.5rem',
          fontFamily: MONO_FONT,
          fontSize: '0.65rem',
          color: 'var(--cp-text)',
          borderRight: '1px solid var(--cp-cyan-glow-soft)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {entry === undefined ? (
          <SkeletonBar />
        ) : entry.success ? (
          formatTime(entry.conversionMs)
        ) : (
          <span style={{ color: 'var(--cp-muted)' }}>--</span>
        )}
      </div>

      {/* Action */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.2rem',
        }}
      >
        {entry !== undefined && entry.success && (
          <button
            onClick={() => {
              downloadBenchmarkResult(entry, baseName)
            }}
            onMouseEnter={() => {
              onHoverButton(buttonKey)
            }}
            onMouseLeave={() => {
              onHoverButton(null)
            }}
            style={{
              background: isButtonHovered ? 'var(--cp-cyan)' : 'transparent',
              color: isButtonHovered ? '#000' : 'var(--cp-cyan)',
              border: '1px solid var(--cp-cyan)',
              fontFamily: MONO_FONT,
              fontSize: '0.55rem',
              letterSpacing: '0.08em',
              padding: '0.15rem 0.4rem',
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            SAVE
          </button>
        )}
      </div>
    </div>
  )
}

/** Animated skeleton placeholder for loading cells. */
function SkeletonBar(): preact.JSX.Element {
  return (
    <div
      style={{
        width: '70%',
        height: '0.6rem',
        background: 'var(--cp-border)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: '40%',
          background: 'linear-gradient(90deg, transparent, var(--cp-cyan-glow-soft), transparent)',
          animation: 'cp-scan 1.4s ease-in-out infinite',
        }}
      />
    </div>
  )
}
