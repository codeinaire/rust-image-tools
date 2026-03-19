import { useState, useRef } from 'preact/hooks'
import type { ImageMetadata } from '../types'
import { trackMetadataViewed } from '../analytics'

const MONO_FONT = "'Share Tech Mono', monospace"

interface MetadataPanelProps {
  metadata: ImageMetadata | null
}

/** Formats a GPS coordinate as a human-readable string with direction. */
export function formatGpsCoord(value: number, isLatitude: boolean): string {
  const direction = isLatitude ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W'
  return `${Math.abs(value).toFixed(6)}\u00b0 ${direction}`
}

/** Collapsible panel displaying image metadata, EXIF data, and PNG text chunks. */
export function MetadataPanel({ metadata }: MetadataPanelProps): preact.JSX.Element | null {
  const [showAllFields, setShowAllFields] = useState(false)
  const trackedRef = useRef(false)

  if (!metadata) {
    return null
  }

  // Local binding after null check so closures see a non-null type
  const meta = metadata

  const hasExif = meta.exif.all_fields.length > 0
  const hasPngText = meta.png_text_chunks.length > 0

  /** Fire analytics event once when any section is expanded. */
  function onSectionToggle(event: Event): void {
    const details = event.currentTarget
    if (!(details instanceof HTMLDetailsElement) || !details.open) {
      return
    }
    if (trackedRef.current) {
      return
    }
    trackedRef.current = true
    trackMetadataViewed({
      source_format: meta.format,
      has_exif: hasExif,
      has_gps: meta.exif.has_gps,
      has_png_text: hasPngText,
      exif_field_count: meta.exif.all_fields.length,
    })
  }

  const labelStyle = {
    color: 'var(--cp-muted)',
    fontFamily: MONO_FONT,
    fontSize: '0.75rem',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    whiteSpace: 'nowrap' as const,
    paddingRight: '1rem',
    paddingTop: '0.15rem',
    paddingBottom: '0.15rem',
    verticalAlign: 'top',
  }

  const valueStyle = {
    color: 'var(--cp-text)',
    fontFamily: MONO_FONT,
    fontSize: '0.75rem',
    letterSpacing: '0.03em',
    paddingTop: '0.15rem',
    paddingBottom: '0.15rem',
  }

  const summaryStyle = {
    cursor: 'pointer',
    color: 'var(--cp-cyan)',
    fontFamily: MONO_FONT,
    fontSize: '0.7rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    userSelect: 'none' as const,
    outline: 'none',
  }

  const thStyle = {
    color: 'var(--cp-muted)',
    fontFamily: MONO_FONT,
    fontSize: '0.75rem',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    whiteSpace: 'nowrap' as const,
    paddingRight: '1rem',
    paddingTop: '0.15rem',
    paddingBottom: '0.25rem',
    verticalAlign: 'top',
    textAlign: 'left' as const,
    borderBottom: '1px solid var(--cp-border)',
  }

  const valueTruncatedStyle = {
    color: 'var(--cp-text)',
    fontFamily: MONO_FONT,
    fontSize: '0.75rem',
    letterSpacing: '0.03em',
    paddingTop: '0.15rem',
    paddingBottom: '0.15rem',
    maxWidth: '200px',
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  }

  const valueMutedStyle = {
    color: 'var(--cp-muted)',
    fontFamily: MONO_FONT,
    fontSize: '0.75rem',
    letterSpacing: '0.03em',
    paddingTop: '0.15rem',
    paddingBottom: '0.15rem',
  }

  const pngValueStyle = {
    color: 'var(--cp-text)',
    fontFamily: MONO_FONT,
    fontSize: '0.75rem',
    letterSpacing: '0.03em',
    paddingTop: '0.15rem',
    paddingBottom: '0.15rem',
    maxWidth: '300px',
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      {/* Basic Info -- always visible */}
      <details open onToggle={onSectionToggle}>
        <summary style={summaryStyle}>IMAGE INFO</summary>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: '0.5rem',
          }}
        >
          <tbody>
            <tr>
              <td style={labelStyle}>Format</td>
              <td style={valueStyle}>{meta.format.toUpperCase()}</td>
            </tr>
            <tr>
              <td style={labelStyle}>Dimensions</td>
              <td style={valueStyle}>
                {meta.width} x {meta.height} px
              </td>
            </tr>
            <tr>
              <td style={labelStyle}>Color Type</td>
              <td style={valueStyle}>{meta.color_type}</td>
            </tr>
            <tr>
              <td style={labelStyle}>Bits/Pixel</td>
              <td style={valueStyle}>{meta.bits_per_pixel}</td>
            </tr>
            <tr>
              <td style={labelStyle}>Alpha</td>
              <td style={valueStyle}>{meta.has_alpha ? 'Yes' : 'No'}</td>
            </tr>
            <tr>
              <td style={labelStyle}>ICC Profile</td>
              <td style={valueStyle}>{meta.has_icc_profile ? 'Present' : 'None'}</td>
            </tr>
          </tbody>
        </table>
      </details>

      {/* EXIF Data */}
      {hasExif && (
        <details style={{ marginTop: '0.75rem' }} onToggle={onSectionToggle}>
          <summary style={summaryStyle}>EXIF DATA</summary>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginTop: '0.5rem',
            }}
          >
            <tbody>
              {meta.exif.camera_make !== null && (
                <tr>
                  <td style={labelStyle}>Camera Make</td>
                  <td style={valueStyle}>{meta.exif.camera_make}</td>
                </tr>
              )}
              {meta.exif.camera_model !== null && (
                <tr>
                  <td style={labelStyle}>Camera Model</td>
                  <td style={valueStyle}>{meta.exif.camera_model}</td>
                </tr>
              )}
              {meta.exif.date_time !== null && (
                <tr>
                  <td style={labelStyle}>Date</td>
                  <td style={valueStyle}>{meta.exif.date_time}</td>
                </tr>
              )}
              {meta.exif.exposure_time !== null && (
                <tr>
                  <td style={labelStyle}>Exposure</td>
                  <td style={valueStyle}>{meta.exif.exposure_time}</td>
                </tr>
              )}
              {meta.exif.f_number !== null && (
                <tr>
                  <td style={labelStyle}>Aperture</td>
                  <td style={valueStyle}>f/{meta.exif.f_number}</td>
                </tr>
              )}
              {meta.exif.iso !== null && (
                <tr>
                  <td style={labelStyle}>ISO</td>
                  <td style={valueStyle}>{meta.exif.iso}</td>
                </tr>
              )}
              {meta.exif.focal_length !== null && (
                <tr>
                  <td style={labelStyle}>Focal Length</td>
                  <td style={valueStyle}>{meta.exif.focal_length}</td>
                </tr>
              )}
              {meta.exif.orientation !== null && (
                <tr>
                  <td style={labelStyle}>Orientation</td>
                  <td style={valueStyle}>{meta.exif.orientation}</td>
                </tr>
              )}
              {meta.exif.software !== null && (
                <tr>
                  <td style={labelStyle}>Software</td>
                  <td style={valueStyle}>{meta.exif.software}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* GPS coordinates */}
          {meta.exif.has_gps &&
            meta.exif.gps_latitude !== null &&
            meta.exif.gps_longitude !== null && (
              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  border: '1px solid var(--cp-yellow)',
                  background: 'rgba(255, 204, 0, 0.05)',
                }}
              >
                <div
                  style={{
                    fontFamily: MONO_FONT,
                    fontSize: '0.7rem',
                    color: 'var(--cp-yellow)',
                    letterSpacing: '0.1em',
                    marginBottom: '0.25rem',
                  }}
                >
                  GPS LOCATION DATA
                </div>
                <div
                  style={{
                    fontFamily: MONO_FONT,
                    fontSize: '0.75rem',
                    color: 'var(--cp-text)',
                  }}
                >
                  {formatGpsCoord(meta.exif.gps_latitude, true)},{' '}
                  {formatGpsCoord(meta.exif.gps_longitude, false)}
                </div>
                <div
                  style={{
                    fontFamily: MONO_FONT,
                    fontSize: '0.65rem',
                    color: 'var(--cp-muted)',
                    marginTop: '0.25rem',
                  }}
                >
                  This image contains location data. Be cautious when sharing.
                </div>
              </div>
            )}

          {/* All fields toggle */}
          {meta.exif.all_fields.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  setShowAllFields((prev) => !prev)
                }}
                style={{
                  background: 'none',
                  border: '1px solid var(--cp-border)',
                  color: 'var(--cp-cyan)',
                  fontFamily: MONO_FONT,
                  fontSize: '0.65rem',
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                  padding: '0.25rem 0.5rem',
                  textTransform: 'uppercase',
                }}
              >
                {showAllFields
                  ? `HIDE ALL FIELDS (${meta.exif.all_fields.length})`
                  : `SHOW ALL FIELDS (${meta.exif.all_fields.length})`}
              </button>

              {showAllFields && (
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    marginTop: '0.5rem',
                  }}
                >
                  <thead>
                    <tr>
                      <th style={thStyle}>Tag</th>
                      <th style={thStyle}>Value</th>
                      <th style={thStyle}>Group</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meta.exif.all_fields.map((field) => (
                      <tr key={`${field.group}-${field.tag}`}>
                        <td style={valueStyle}>{field.tag}</td>
                        <td style={valueTruncatedStyle}>{field.value}</td>
                        <td style={valueMutedStyle}>{field.group}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </details>
      )}

      {/* PNG Text Chunks */}
      {hasPngText && (
        <details style={{ marginTop: '0.75rem' }} onToggle={onSectionToggle}>
          <summary style={summaryStyle}>PNG TEXT CHUNKS</summary>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginTop: '0.5rem',
            }}
          >
            <tbody>
              {meta.png_text_chunks.map((chunk) => (
                <tr key={chunk.keyword}>
                  <td style={labelStyle}>{chunk.keyword}</td>
                  <td style={pngValueStyle}>{chunk.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  )
}
