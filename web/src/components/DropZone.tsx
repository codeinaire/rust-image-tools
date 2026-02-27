import { useState, useRef } from 'preact/hooks'
import type { FileInfo } from '../hooks/useConverter'

type Props = {
  onFile: (file: File, inputMethod: 'file_picker' | 'drag_drop') => void
  fileInfo: FileInfo | null
}

const CLIP = 'polygon(20px 0%, 100% 0%, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0% 100%, 0% 20px)'

export function DropZone({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

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
  const glowColor = isDragOver
    ? 'rgba(255, 230, 0, 0.4)'
    : 'rgba(0, 245, 255, 0.3)'

  return (
    <div
      id="drop-zone"
      style={{
        padding: '2px',
        background: borderColor,
        clipPath: CLIP,
        filter: `drop-shadow(0 0 10px ${glowColor})`,
        cursor: 'pointer',
        transition: 'filter 0.2s, background 0.2s',
      }}
      onClick={() => inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        style={{
          clipPath: CLIP,
          background: isDragOver ? 'var(--cp-panel-light)' : 'var(--cp-panel)',
          padding: '2.5rem 2rem',
          textAlign: 'center',
          transition: 'background 0.2s',
        }}
      >
        <p style={{ color: 'var(--cp-cyan)', fontSize: '1.125rem', letterSpacing: '0.05em' }}>
          {isDragOver ? '[ RELEASE TO UPLOAD ]' : 'DRAG & DROP IMAGE — OR CLICK TO SELECT'}
        </p>
        <p style={{ color: 'var(--cp-muted)', fontSize: '0.8rem', marginTop: '0.5rem', letterSpacing: '0.1em' }}>
          PNG · JPEG · WEBP · GIF · BMP — UP TO 200 MB
        </p>
        <input
          ref={inputRef}
          id="file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
          class="hidden"
          onChange={handleInputChange}
        />
      </div>
    </div>
  )
}
