type Props = {
  value: string
  onChange: (format: string) => void
  onConvert: () => void
  disabled: boolean
}

export function FormatSelector({ value, onChange, onConvert, disabled }: Props) {
  return (
    <div class="flex flex-col sm:flex-row items-center gap-4">
      <div class="flex items-center gap-3">
        <label
          for="format-select"
          style={{
            fontSize: '0.75rem',
            letterSpacing: '0.15em',
            color: 'var(--cp-muted)',
          }}
        >
          CONVERT TO:
        </label>
        <select
          id="format-select"
          value={value}
          onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
          style={{
            background: 'var(--cp-bg)',
            color: 'var(--cp-cyan)',
            border: '1px solid var(--cp-cyan)',
            padding: '0.5rem 0.75rem',
            fontFamily: "'Share Tech Mono', monospace",
            letterSpacing: '0.1em',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="png">PNG</option>
          <option value="jpeg">JPEG</option>
          <option value="webp">WEBP</option>
          <option value="gif">GIF</option>
          <option value="bmp">BMP</option>
        </select>
      </div>
      <button
        id="convert-btn"
        disabled={disabled}
        onClick={onConvert}
        style={{
          fontFamily: "'Orbitron', monospace",
          background: disabled ? 'transparent' : 'var(--cp-yellow)',
          color: disabled ? 'var(--cp-muted)' : '#000',
          border: `2px solid ${disabled ? 'var(--cp-border)' : 'var(--cp-yellow)'}`,
          boxShadow: disabled ? 'none' : '0 0 14px rgba(255, 230, 0, 0.5)',
          padding: '0.5rem 1.75rem',
          letterSpacing: '0.15em',
          fontWeight: '700',
          fontSize: '0.875rem',
          cursor: disabled ? 'not-allowed' : 'pointer',
          clipPath:
            'polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%)',
          transition: 'box-shadow 0.2s, background 0.2s',
        }}
      >
        EXECUTE
      </button>
    </div>
  )
}
