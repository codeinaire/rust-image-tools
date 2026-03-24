import { useEffect } from 'preact/hooks'
import { createPortal } from 'preact/compat'
import { MetadataPanel } from './MetadataPanel'
import type { ImageMetadata } from '../types'

const MONO = "'Share Tech Mono', monospace"

interface MetadataModalProps {
  metadata: ImageMetadata
  onClose: () => void
}

/** Full-screen modal overlay displaying image metadata with portal rendering. */
export function MetadataModal({ metadata, onClose }: MetadataModalProps): preact.JSX.Element {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

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
          background: 'var(--cp-panel)',
          border: '1px solid var(--cp-cyan)',
          maxWidth: '520px',
          width: '90vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 0 30px var(--cp-cyan-glow), 0 0 60px var(--cp-cyan-glow-subtle)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--cp-border)',
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: '0.8rem',
              color: 'var(--cp-cyan)',
              letterSpacing: '0.15em',
            }}
          >
            IMAGE METADATA
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--cp-border)',
              color: 'var(--cp-muted)',
              cursor: 'pointer',
              fontFamily: MONO,
              fontSize: '0.65rem',
              letterSpacing: '0.1em',
              padding: '0.2rem 0.5rem',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--cp-text)'
              e.currentTarget.style.borderColor = 'var(--cp-cyan)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--cp-muted)'
              e.currentTarget.style.borderColor = 'var(--cp-border)'
            }}
          >
            CLOSE
          </button>
        </div>

        {/* Scrollable content */}
        <div
          style={{
            padding: '0.75rem 1rem',
            overflowY: 'auto',
          }}
        >
          <MetadataPanel metadata={metadata} expandAll />
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body) as preact.JSX.Element
}
