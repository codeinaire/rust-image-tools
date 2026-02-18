import posthog from 'posthog-js'

type FormatPairProps = {
  source_format: string
  target_format: string
}

type ImageDimensionProps = {
  width: number
  height: number
  megapixels: number
}

let initialized = false

export function initAnalytics(): void {
  if (process.env.NODE_ENV !== 'production') return
  const key = process.env.POSTHOG_KEY
  if (!key) return

  posthog.init(key, {
    api_host: 'https://eu.i.posthog.com',
    autocapture: false,
    request_batching: false,
    person_profiles: 'always',
    debug: process.env.NODE_ENV !== 'production',
  })
  initialized = true
}

function capture(event: string, properties: Record<string, unknown>): void {
  if (!initialized) return
  console.log('[posthog]', event, properties)
  posthog.capture(event, properties)
}

export function trackAppLoaded(props: { wasm_init_ms: number }): void {
  capture('app_loaded', props)
}

export function trackImageSelected(
  props: ImageDimensionProps & {
    source_format: string
    file_size_bytes: number
    input_method: 'file_picker' | 'drag_drop'
  },
): void {
  capture('image_selected', props)
}

export function trackConversionStarted(
  props: FormatPairProps & { file_size_bytes: number; megapixels: number },
): void {
  capture('conversion_started', props)
}

export function trackConversionCompleted(
  props: FormatPairProps &
    ImageDimensionProps & {
      input_size_bytes: number
      output_size_bytes: number
      size_change_pct: number
      conversion_ms: number
      pipeline_total_ms: number
    },
): void {
  capture('conversion_completed', props)
}

export function trackConversionFailed(props: {
  source_format: string | null
  target_format: string
  file_size_bytes: number
  error_type: string
  error_message: string
}): void {
  capture('conversion_failed', props)
}

export function trackValidationRejected(props: {
  reason: string
  file_size_bytes: number
  megapixels: number | null
}): void {
  capture('validation_rejected', props)
}

export function trackDownloadClicked(props: FormatPairProps & { output_size_bytes: number }): void {
  capture('download_clicked', props)
}

