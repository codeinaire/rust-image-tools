import { useRef, useEffect } from 'preact/hooks'
import type { ConverterStatus } from '../hooks/useConverter'

type Props = {
  status: ConverterStatus
  estimatedMs: number
  showProgress: boolean
}

export function ProgressBar({ status, estimatedMs, showProgress }: Props) {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!barRef.current) return
    if (status === 'converting') {
      barRef.current.style.transition = 'width 0ms ease-out'
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

  if (!showProgress) return null

  return (
    <div>
      <div
        style={{
          width: '100%',
          background: 'var(--cp-cyan-glow-subtle)',
          height: '3px',
          position: 'relative',
        }}
      >
        <div
          ref={barRef}
          style={{
            background: 'var(--cp-cyan)',
            height: '3px',
            boxShadow: '0 0 8px var(--cp-cyan), 0 0 20px var(--cp-cyan-glow-strong)',
            width: '0%',
            transition: 'width 0ms ease-out',
          }}
        />
      </div>
      <p
        style={{
          color: 'var(--cp-cyan)',
          fontSize: '0.75rem',
          marginTop: '0.35rem',
          letterSpacing: '0.15em',
        }}
      >
        {status === 'done' ? '[ COMPLETE ]' : '[ PROCESSING... ]'}
      </p>
    </div>
  )
}
