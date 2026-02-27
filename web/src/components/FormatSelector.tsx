import { useState, useEffect, useRef } from 'preact/hooks'

type Props = {
  value: string
  onChange: (format: string) => void
}

const FORMATS = ['png', 'jpeg', 'webp', 'gif', 'bmp']

export function FormatSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function openDropdown() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen((o) => !o)
  }

  function select(format: string) {
    onChange(format)
    setOpen(false)
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
    >
      <label
        style={{
          fontSize: '0.75rem',
          letterSpacing: '0.15em',
          color: 'var(--cp-muted)',
          whiteSpace: 'nowrap',
        }}
      >
        CONVERT TO:
      </label>

      <div
        ref={triggerRef}
        onClick={openDropdown}
        style={{
          background: 'var(--cp-bg)',
          color: 'var(--cp-cyan)',
          border: `1px solid ${open ? 'var(--cp-yellow)' : 'var(--cp-cyan)'}`,
          boxShadow: open ? '0 0 8px var(--cp-yellow-glow)' : '0 0 6px var(--cp-cyan-glow-subtle)',
          padding: '0.5rem 0.75rem',
          fontFamily: "'Share Tech Mono', monospace",
          letterSpacing: '0.1em',
          fontSize: '0.875rem',
          cursor: 'pointer',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          minWidth: '6rem',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        <span style={{ flex: 1 }}>{value.toUpperCase()}</span>
        <span
          style={{
            color: open ? 'var(--cp-yellow)' : 'var(--cp-cyan)',
            fontSize: '0.6rem',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s, color 0.15s',
            lineHeight: 1,
          }}
        >
          ▼
        </span>
      </div>

      {open && (
        <div
          style={{
            position: 'fixed',
            top: `${dropdownPos.top}px`,
            left: `${dropdownPos.left}px`,
            background: 'var(--cp-panel)',
            border: '1px solid var(--cp-cyan)',
            boxShadow: '0 0 20px var(--cp-cyan-glow-subtle), 0 8px 32px rgba(0,0,0,0.6)',
            zIndex: 9999,
            minWidth: '8rem',
          }}
        >
          {FORMATS.map((fmt) => (
            <div
              key={fmt}
              onClick={() => select(fmt)}
              style={{
                padding: '0.5rem 0.75rem',
                fontFamily: "'Share Tech Mono', monospace",
                letterSpacing: '0.1em',
                fontSize: '0.875rem',
                cursor: 'pointer',
                color: fmt === value ? 'var(--cp-yellow)' : 'var(--cp-text)',
                background: fmt === value ? 'rgba(255,230,0,0.06)' : 'transparent',
                borderLeft: fmt === value ? '2px solid var(--cp-yellow)' : '2px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
              onMouseEnter={(e) => {
                if (fmt !== value) {
                  ;(e.currentTarget as HTMLElement).style.background = 'rgba(0,245,255,0.06)'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--cp-cyan)'
                }
              }}
              onMouseLeave={(e) => {
                if (fmt !== value) {
                  ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--cp-text)'
                }
              }}
            >
              <span style={{ fontSize: '0.5rem', opacity: fmt === value ? 1 : 0 }}>◆</span>
              {fmt.toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
