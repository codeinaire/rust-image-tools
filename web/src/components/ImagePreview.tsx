import { useState, useEffect, useRef } from 'preact/hooks'
import { formatFileSize } from '../hooks/useConverter'
import type { FileInfo, ConversionResult } from '../hooks/useConverter'

interface Props {
  fileInfo: FileInfo
  result: ConversionResult | null
}

/**
 * Creates an object URL from raw image bytes and the source file's MIME type.
 * Returns the URL and a cleanup function.
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

const labelStyle = {
  color: 'var(--cp-muted)',
  fontFamily: "'Share Tech Mono', monospace",
  fontSize: '0.6rem',
  letterSpacing: '0.15em',
  marginBottom: '0.375rem',
}

const metaStyle = {
  color: 'var(--cp-text)',
  fontFamily: "'Share Tech Mono', monospace",
  fontSize: '0.6rem',
  letterSpacing: '0.08em',
  marginTop: '0.375rem',
}

const imgStyle = {
  maxWidth: '100%',
  maxHeight: '18rem',
  objectFit: 'contain',
  border: '1px solid var(--cp-border)',
  display: 'block',
}

/** Side-by-side preview of source and converted images. */
export function ImagePreview({ fileInfo, result }: Props): preact.JSX.Element {
  const sourceUrl = useObjectUrl(fileInfo.file)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: result ? '1fr 1fr' : '1fr',
        gap: '1rem',
        padding: '1rem',
        background: 'var(--cp-shadow-soft)',
        border: '1px solid var(--cp-border)',
      }}
    >
      {/* Source image */}
      <div>
        <div style={labelStyle}>// SOURCE</div>
        {sourceUrl && (
          <img
            src={sourceUrl}
            alt={`Source image (${fileInfo.sourceFormat.toUpperCase()})`}
            style={imgStyle}
          />
        )}
        <div style={metaStyle}>
          {fileInfo.sourceFormat.toUpperCase()} — {fileInfo.width}×{fileInfo.height} —{' '}
          {formatFileSize(fileInfo.file.size)}
        </div>
      </div>

      {/* Output image */}
      {result && (
        <div>
          <div style={labelStyle}>// OUTPUT</div>
          <img
            src={result.blobUrl}
            alt={`Converted image (${result.extension.toUpperCase()})`}
            style={imgStyle}
          />
          <div style={metaStyle}>
            {result.extension.toUpperCase()} — {formatFileSize(result.outputSize)}
          </div>
        </div>
      )}
    </div>
  )
}
