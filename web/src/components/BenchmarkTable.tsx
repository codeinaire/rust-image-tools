import { useState } from 'preact/hooks'
import { ValidFormat } from '../types'
import { formatFileSize } from '../hooks/useConverter'
import type { BenchmarkState, BenchmarkEntry } from '../hooks/useBenchmark'
import type { ConversionResult, FileInfo } from '../hooks/useConverter'

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
  onConvertFormat: (format: ValidFormat) => void
  conversionResult: ConversionResult | null
  convertingFormat: ValidFormat | null
  isMobile: boolean
  disabled: boolean
}

const ALL_FORMATS: ValidFormat[] = Object.values(ValidFormat)

const MONO_FONT = "'Share Tech Mono', monospace"

/** Formats a time value as a human-readable string. */
export function formatTime(ms: number): string {
  if (ms < 1000) {
    return `${ms} ms`
  }
  return `${(ms / 1000).toFixed(1)} s`
}

/** Finds the entry with the smallest output size among successful results. */
export function findSmallestFormat(results: BenchmarkEntry[]): ValidFormat | null {
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

/** Triggers a browser download from raw bytes. */
function downloadBytes(data: Uint8Array, format: ValidFormat, baseName: string): void {
  const extension = format === ValidFormat.Jpeg ? 'jpg' : format
  const filename = `${baseName}.${extension}`
  const mimeType = MIME_TYPES[format] ?? 'application/octet-stream'
  const blob = new Blob([data.buffer as ArrayBuffer], { type: mimeType })
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
  onConvertFormat,
  conversionResult,
  convertingFormat,
  isMobile,
  disabled,
}: Props): preact.JSX.Element | null {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null)

  const baseName = fileInfo ? fileInfo.file.name.replace(/\.[^.]+$/, '') : ''

  if (!fileInfo) {
    return null
  }

  const hasResults = benchmarkState.totalFormats > 0
  const isComplete = !benchmarkState.isRunning && hasResults
  const showActionColumn = !isMobile

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
            gridTemplateColumns: showActionColumn
              ? '4.5rem 1fr 4rem 4rem 3.5rem'
              : '4.5rem 1fr 4rem 4rem',
            borderBottom: '1px solid var(--cp-cyan)',
            background: 'var(--cp-cyan-bg-faint)',
          }}
        >
          {(showActionColumn
            ? ['FORMAT', 'SIZE', 'DELTA', 'TIME', '']
            : ['FORMAT', 'SIZE', 'DELTA', 'TIME']
          ).map((header, i, arr) => (
            <div
              key={header || 'action'}
              style={{
                padding: '0.4rem 0.5rem',
                color: 'var(--cp-muted)',
                fontFamily: MONO_FONT,
                fontSize: '0.55rem',
                letterSpacing: '0.1em',
                ...(i < arr.length - 1
                  ? { borderRight: '1px solid var(--cp-cyan-glow-soft)' }
                  : {}),
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
          const isConvertingThis = convertingFormat === format
          const hasConversionResult =
            conversionResult !== null && conversionResult.targetFormat === format

          return (
            <BenchmarkRow
              key={format}
              format={format}
              entry={entry}
              isSmallest={isSmallest}
              isLast={isLast}
              baseName={baseName}
              showActionColumn={showActionColumn}
              isConvertingThis={isConvertingThis}
              conversionResult={hasConversionResult ? conversionResult : null}
              onConvertFormat={onConvertFormat}
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
  showActionColumn: boolean
  isConvertingThis: boolean
  conversionResult: ConversionResult | null
  onConvertFormat: (format: ValidFormat) => void
  hoveredButton: string | null
  onHoverButton: (key: string | null) => void
}

/**
 * A single row in the benchmark table.
 *
 * Action button behavior:
 * - Entry has `data` (≤5 MB desktop): DL button for instant download from cached bytes
 * - Entry has no `data` (>5 MB desktop): GO button triggers conversion via normal pipeline;
 *   after conversion completes, switches to DL using the conversion result's blobUrl
 * - Mobile: no action column
 */
function BenchmarkRow({
  format,
  entry,
  isSmallest,
  isLast,
  baseName,
  showActionColumn,
  isConvertingThis,
  conversionResult,
  onConvertFormat,
  hoveredButton,
  onHoverButton,
}: BenchmarkRowProps): preact.JSX.Element {
  const rowBackground = isSmallest ? 'var(--cp-cyan-bg-faint)' : 'transparent'
  const borderBottom = isLast ? 'none' : '1px solid var(--cp-border)'
  const buttonKey = `action-${format}`
  const isButtonHovered = hoveredButton === buttonKey

  const hasCachedBytes = entry !== undefined && entry.success && entry.data !== undefined
  const hasConversionDownload = conversionResult !== null

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: showActionColumn
          ? '4.5rem 1fr 4rem 4rem 3.5rem'
          : '4.5rem 1fr 4rem 4rem',
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
          ...(showActionColumn ? { borderRight: '1px solid var(--cp-cyan-glow-soft)' } : {}),
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
      {showActionColumn && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.2rem',
          }}
        >
          {entry !== undefined && entry.success && (
            <ActionButton
              format={format}
              baseName={baseName}
              hasCachedBytes={hasCachedBytes}
              cachedData={hasCachedBytes && entry.data ? entry.data : undefined}
              hasConversionDownload={hasConversionDownload}
              conversionResult={conversionResult}
              isConvertingThis={isConvertingThis}
              isButtonHovered={isButtonHovered}
              buttonKey={buttonKey}
              onConvertFormat={onConvertFormat}
              onHoverButton={onHoverButton}
            />
          )}
        </div>
      )}
    </div>
  )
}

interface ActionButtonProps {
  format: ValidFormat
  baseName: string
  hasCachedBytes: boolean
  cachedData: Uint8Array | undefined
  hasConversionDownload: boolean
  conversionResult: ConversionResult | null
  isConvertingThis: boolean
  isButtonHovered: boolean
  buttonKey: string
  onConvertFormat: (format: ValidFormat) => void
  onHoverButton: (key: string | null) => void
}

/**
 * Renders the appropriate action for a benchmark row:
 * - Cached bytes available (≤5 MB): cyan DL button for instant download
 * - Conversion completed via pipeline (>5 MB): cyan DL link using blobUrl
 * - Neither: yellow GO button to trigger conversion
 * - Currently converting: disabled "..." button
 */
function ActionButton({
  format,
  baseName,
  hasCachedBytes,
  cachedData,
  hasConversionDownload,
  conversionResult,
  isConvertingThis,
  isButtonHovered,
  buttonKey,
  onConvertFormat,
  onHoverButton,
}: ActionButtonProps): preact.JSX.Element {
  const hoverHandlers = {
    onMouseEnter: () => {
      onHoverButton(buttonKey)
    },
    onMouseLeave: () => {
      onHoverButton(null)
    },
  }

  const dlStyle = {
    background: isButtonHovered ? 'var(--cp-cyan)' : 'transparent',
    color: isButtonHovered ? '#000' : 'var(--cp-cyan)',
    border: '1px solid var(--cp-cyan)',
    fontFamily: MONO_FONT,
    fontSize: '0.5rem',
    letterSpacing: '0.08em',
    padding: '0.15rem 0.25rem',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
    textDecoration: 'none',
  }

  // Instant download from cached benchmark bytes (≤5 MB)
  if (hasCachedBytes && cachedData) {
    return (
      <button
        onClick={() => {
          downloadBytes(cachedData, format, baseName)
        }}
        style={dlStyle}
        {...hoverHandlers}
      >
        DL
      </button>
    )
  }

  // Download from completed conversion (>5 MB, after GO was clicked)
  if (hasConversionDownload && conversionResult) {
    return (
      <a
        href={conversionResult.blobUrl}
        download={conversionResult.filename}
        style={dlStyle}
        {...hoverHandlers}
      >
        DL
      </a>
    )
  }

  // Trigger conversion (>5 MB, not yet converted)
  return (
    <button
      disabled={isConvertingThis}
      onClick={() => {
        onConvertFormat(format)
      }}
      style={{
        background: isConvertingThis
          ? 'var(--cp-border)'
          : isButtonHovered
            ? 'var(--cp-yellow)'
            : 'transparent',
        color: isConvertingThis ? 'var(--cp-muted)' : isButtonHovered ? '#000' : 'var(--cp-yellow)',
        border: `1px solid ${isConvertingThis ? 'var(--cp-border)' : 'var(--cp-yellow)'}`,
        fontFamily: MONO_FONT,
        fontSize: '0.5rem',
        letterSpacing: '0.08em',
        padding: '0.15rem 0.25rem',
        cursor: isConvertingThis ? 'wait' : 'pointer',
        transition: 'background 0.15s, color 0.15s',
      }}
      {...hoverHandlers}
    >
      {isConvertingThis ? '...' : 'GO'}
    </button>
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
