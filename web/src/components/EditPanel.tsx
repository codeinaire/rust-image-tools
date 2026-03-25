import { useState } from 'preact/hooks'
import { Slider } from './Slider'
import type { ResizeState, CropState, AdjustmentsState, BlurType } from '../hooks/useProcessing'
import type { ResizeFilter } from '../types'

interface EditPanelProps {
  /** Current resize operation state. */
  resize: ResizeState
  /** Current crop operation state. */
  crop: CropState
  /** Current adjustments state. */
  adjustments: AdjustmentsState
  /** Source image width (for validation constraints). */
  sourceWidth: number
  /** Source image height (for validation constraints). */
  sourceHeight: number
  /** Callback to update resize state. */
  onResizeChange: (update: Partial<ResizeState>) => void
  /** Callback to update crop state. */
  onCropChange: (update: Partial<CropState>) => void
  /** Callback to update adjustments state. */
  onAdjustmentsChange: (update: Partial<AdjustmentsState>) => void
  /** Callback to reset a specific section. */
  onResetSection: (section: 'resize' | 'crop' | 'adjustments') => void
  /** Callback to reset all sections. */
  onResetAll: () => void
  /** Whether the panel controls are disabled (e.g. during conversion). */
  disabled: boolean
}

/** Shared inline styles for section headers. */
const SECTION_HEADER_STYLE = {
  fontFamily: "'Share Tech Mono', monospace",
  fontSize: '0.75rem',
  letterSpacing: '0.15em',
  color: 'var(--cp-cyan)',
  cursor: 'pointer',
  userSelect: 'none' as const,
}

/** Shared inline styles for number inputs. */
const NUMBER_INPUT_STYLE = {
  background: 'var(--cp-panel)',
  border: '1px solid var(--cp-border)',
  color: 'var(--cp-text)',
  fontFamily: "'Share Tech Mono', monospace",
  fontSize: '0.75rem',
  padding: '0.25rem 0.5rem',
  width: '5rem',
}

/** Shared inline styles for labels. */
const LABEL_STYLE = {
  color: 'var(--cp-muted)',
  fontFamily: "'Share Tech Mono', monospace",
  fontSize: '0.65rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
}

/** Shared inline styles for select dropdowns. */
const SELECT_STYLE = {
  background: 'var(--cp-panel)',
  border: '1px solid var(--cp-border)',
  color: 'var(--cp-text)',
  fontFamily: "'Share Tech Mono', monospace",
  fontSize: '0.7rem',
  padding: '0.25rem 0.5rem',
}

/** Resize filter options with display labels. */
const FILTER_OPTIONS: { value: ResizeFilter; label: string }[] = [
  { value: 'lanczos3', label: 'Lanczos3 (sharp)' },
  { value: 'catmull_rom', label: 'CatmullRom' },
  { value: 'gaussian', label: 'Gaussian' },
  { value: 'triangle', label: 'Bilinear' },
  { value: 'nearest', label: 'Nearest' },
]

/**
 * Inline edit panel for configuring image processing operations.
 *
 * Renders collapsible sections for Resize, Crop, and Adjustments,
 * each with an enable/disable toggle and appropriate controls.
 * Matches the cyberpunk UI theme of the rest of the app.
 */
export function EditPanel({
  resize,
  crop,
  adjustments,
  sourceWidth,
  sourceHeight,
  onResizeChange,
  onCropChange,
  onAdjustmentsChange,
  onResetSection,
  onResetAll,
  disabled,
}: EditPanelProps): preact.JSX.Element {
  const [resizeOpen, setResizeOpen] = useState(false)
  const [cropOpen, setCropOpen] = useState(false)
  const [adjustmentsOpen, setAdjustmentsOpen] = useState(false)

  return (
    <div
      style={{
        border: '1px solid var(--cp-border)',
        background: 'var(--cp-panel-light)',
        padding: '1rem',
      }}
    >
      {/* Panel header */}
      <div class="flex items-center justify-between" style={{ marginBottom: '0.75rem' }}>
        <span
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '0.8rem',
            letterSpacing: '0.15em',
            color: 'var(--cp-yellow)',
            textTransform: 'uppercase',
          }}
        >
          EDIT IMAGE
        </span>
        <button
          type="button"
          onClick={onResetAll}
          disabled={disabled}
          style={{
            background: 'none',
            border: '1px solid var(--cp-border)',
            color: 'var(--cp-muted)',
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '0.6rem',
            letterSpacing: '0.1em',
            padding: '0.2rem 0.5rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          RESET ALL
        </button>
      </div>

      {/* ─── Resize Section ─── */}
      <CollapsibleSection
        title="RESIZE"
        enabled={resize.enabled}
        open={resizeOpen}
        onToggleOpen={() => {
          setResizeOpen((o) => !o)
        }}
        onToggleEnabled={(enabled) => {
          onResizeChange({ enabled })
        }}
        onReset={() => {
          onResetSection('resize')
        }}
        disabled={disabled}
      >
        <div class="flex flex-col gap-2" style={{ padding: '0.5rem 0' }}>
          <div class="flex items-center gap-3">
            <div class="flex flex-col gap-1">
              <span style={LABEL_STYLE}>Width</span>
              <input
                type="number"
                value={resize.width}
                min={1}
                disabled={disabled || !resize.enabled}
                style={NUMBER_INPUT_STYLE}
                onInput={(e) => {
                  onResizeChange({ width: Math.max(1, Number(e.currentTarget.value)) })
                }}
              />
            </div>
            <button
              type="button"
              title={resize.lockAspectRatio ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
              disabled={disabled || !resize.enabled}
              onClick={() => {
                onResizeChange({ lockAspectRatio: !resize.lockAspectRatio })
              }}
              style={{
                background: 'none',
                border: 'none',
                color: resize.lockAspectRatio ? 'var(--cp-cyan)' : 'var(--cp-muted)',
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '1rem',
                cursor: disabled || !resize.enabled ? 'not-allowed' : 'pointer',
                marginTop: '1rem',
              }}
            >
              {resize.lockAspectRatio ? '\u{1F517}' : '\u{26D3}'}
            </button>
            <div class="flex flex-col gap-1">
              <span style={LABEL_STYLE}>Height</span>
              <input
                type="number"
                value={resize.height}
                min={1}
                disabled={disabled || !resize.enabled}
                style={NUMBER_INPUT_STYLE}
                onInput={(e) => {
                  onResizeChange({ height: Math.max(1, Number(e.currentTarget.value)) })
                }}
              />
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <span style={LABEL_STYLE}>Filter</span>
            <select
              value={resize.filter}
              disabled={disabled || !resize.enabled}
              style={SELECT_STYLE}
              onChange={(e) => {
                onResizeChange({ filter: e.currentTarget.value as ResizeFilter })
              }}
            >
              {FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CollapsibleSection>

      {/* ─── Crop Section ─── */}
      <CollapsibleSection
        title="CROP"
        enabled={crop.enabled}
        open={cropOpen}
        onToggleOpen={() => {
          setCropOpen((o) => !o)
        }}
        onToggleEnabled={(enabled) => {
          // Initialize crop to full image dimensions when enabling
          if (enabled) {
            onCropChange({ enabled: true, x: 0, y: 0, width: sourceWidth, height: sourceHeight })
          } else {
            onCropChange({ enabled: false })
          }
        }}
        onReset={() => {
          onResetSection('crop')
        }}
        disabled={disabled}
      >
        <div class="flex flex-wrap gap-3" style={{ padding: '0.5rem 0' }}>
          <div class="flex flex-col gap-1">
            <span style={LABEL_STYLE}>X</span>
            <input
              type="number"
              value={crop.x}
              min={0}
              max={sourceWidth - 1}
              disabled={disabled || !crop.enabled}
              style={NUMBER_INPUT_STYLE}
              onInput={(e) => {
                onCropChange({ x: Math.max(0, Number(e.currentTarget.value)) })
              }}
            />
          </div>
          <div class="flex flex-col gap-1">
            <span style={LABEL_STYLE}>Y</span>
            <input
              type="number"
              value={crop.y}
              min={0}
              max={sourceHeight - 1}
              disabled={disabled || !crop.enabled}
              style={NUMBER_INPUT_STYLE}
              onInput={(e) => {
                onCropChange({ y: Math.max(0, Number(e.currentTarget.value)) })
              }}
            />
          </div>
          <div class="flex flex-col gap-1">
            <span style={LABEL_STYLE}>Width</span>
            <input
              type="number"
              value={crop.width}
              min={1}
              max={sourceWidth}
              disabled={disabled || !crop.enabled}
              style={NUMBER_INPUT_STYLE}
              onInput={(e) => {
                onCropChange({ width: Math.max(1, Number(e.currentTarget.value)) })
              }}
            />
          </div>
          <div class="flex flex-col gap-1">
            <span style={LABEL_STYLE}>Height</span>
            <input
              type="number"
              value={crop.height}
              min={1}
              max={sourceHeight}
              disabled={disabled || !crop.enabled}
              style={NUMBER_INPUT_STYLE}
              onInput={(e) => {
                onCropChange({ height: Math.max(1, Number(e.currentTarget.value)) })
              }}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* ─── Adjustments Section ─── */}
      <CollapsibleSection
        title="ADJUSTMENTS"
        enabled={true}
        open={adjustmentsOpen}
        onToggleOpen={() => {
          setAdjustmentsOpen((o) => !o)
        }}
        onReset={() => {
          onResetSection('adjustments')
        }}
        disabled={disabled}
        alwaysEnabled
      >
        <div class="flex flex-col gap-3" style={{ padding: '0.5rem 0' }}>
          <Slider
            label="Brightness"
            min={-255}
            max={255}
            step={1}
            value={adjustments.brightness}
            onChange={(value) => {
              onAdjustmentsChange({ brightness: value })
            }}
            disabled={disabled}
          />
          <Slider
            label="Contrast"
            min={-100}
            max={100}
            step={1}
            value={adjustments.contrast}
            onChange={(value) => {
              onAdjustmentsChange({ contrast: value })
            }}
            disabled={disabled}
          />
          <Slider
            label="Hue Rotate"
            min={0}
            max={360}
            step={1}
            value={adjustments.hueRotate}
            onChange={(value) => {
              onAdjustmentsChange({ hueRotate: value })
            }}
            disabled={disabled}
          />
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <Slider
                label="Blur"
                min={0}
                max={20}
                step={0.5}
                value={adjustments.blurSigma}
                onChange={(value) => {
                  onAdjustmentsChange({ blurSigma: value })
                }}
                disabled={disabled}
              />
            </div>
            <div class="flex items-center gap-2" style={{ marginTop: '0.25rem' }}>
              <span style={{ ...LABEL_STYLE, fontSize: '0.6rem' }}>Type:</span>
              <button
                type="button"
                onClick={() => {
                  onAdjustmentsChange({ blurType: 'gaussian' as BlurType })
                }}
                disabled={disabled}
                style={{
                  background:
                    adjustments.blurType === 'gaussian' ? 'var(--cp-cyan-bg-dim)' : 'none',
                  border: `1px solid ${adjustments.blurType === 'gaussian' ? 'var(--cp-cyan)' : 'var(--cp-border)'}`,
                  color: adjustments.blurType === 'gaussian' ? 'var(--cp-cyan)' : 'var(--cp-muted)',
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: '0.6rem',
                  padding: '0.15rem 0.4rem',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
              >
                GAUSSIAN
              </button>
              <button
                type="button"
                onClick={() => {
                  onAdjustmentsChange({ blurType: 'fast' as BlurType })
                }}
                disabled={disabled}
                style={{
                  background: adjustments.blurType === 'fast' ? 'var(--cp-cyan-bg-dim)' : 'none',
                  border: `1px solid ${adjustments.blurType === 'fast' ? 'var(--cp-cyan)' : 'var(--cp-border)'}`,
                  color: adjustments.blurType === 'fast' ? 'var(--cp-cyan)' : 'var(--cp-muted)',
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: '0.6rem',
                  padding: '0.15rem 0.4rem',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
              >
                FAST
              </button>
            </div>
          </div>
          <Slider
            label="Unsharpen Sigma"
            min={0}
            max={10}
            step={0.5}
            value={adjustments.unsharpenSigma}
            onChange={(value) => {
              onAdjustmentsChange({ unsharpenSigma: value })
            }}
            disabled={disabled}
          />
          <Slider
            label="Unsharpen Threshold"
            min={0}
            max={20}
            step={1}
            value={adjustments.unsharpenThreshold}
            onChange={(value) => {
              onAdjustmentsChange({ unsharpenThreshold: value })
            }}
            disabled={disabled}
          />
        </div>
      </CollapsibleSection>
    </div>
  )
}

// ─── Collapsible Section Sub-component ────────────────────────────────

interface CollapsibleSectionProps {
  title: string
  enabled: boolean
  open: boolean
  onToggleOpen: () => void
  onToggleEnabled?: (enabled: boolean) => void
  onReset: () => void
  disabled: boolean
  alwaysEnabled?: boolean
  children: preact.ComponentChildren
}

/**
 * A collapsible section with an enable/disable toggle and reset button.
 * Used internally by EditPanel for each operation group.
 */
function CollapsibleSection({
  title,
  enabled,
  open,
  onToggleOpen,
  onToggleEnabled,
  onReset,
  disabled,
  alwaysEnabled = false,
  children,
}: CollapsibleSectionProps): preact.JSX.Element {
  return (
    <div
      style={{
        borderTop: '1px solid var(--cp-border)',
        marginTop: '0.5rem',
        paddingTop: '0.5rem',
      }}
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          {!alwaysEnabled && onToggleEnabled && (
            <input
              type="checkbox"
              checked={enabled}
              disabled={disabled}
              onChange={(e) => {
                onToggleEnabled(e.currentTarget.checked)
              }}
              style={{ accentColor: 'var(--cp-cyan)' }}
            />
          )}
          <button
            type="button"
            onClick={onToggleOpen}
            style={{
              ...SECTION_HEADER_STYLE,
              background: 'none',
              border: 'none',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span style={{ fontSize: '0.6rem' }}>{open ? '\u25BC' : '\u25B6'}</span>
            {title}
          </button>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={disabled}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--cp-muted)',
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '0.55rem',
            letterSpacing: '0.08em',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          RESET
        </button>
      </div>
      {open && <div style={{ opacity: alwaysEnabled || enabled ? 1 : 0.4 }}>{children}</div>}
    </div>
  )
}
