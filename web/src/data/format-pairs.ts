import { ValidFormat } from '../types'
import type { InputFormat } from '../types'

/** Display metadata for a single image format. */
export interface FormatMeta {
  /** Display name shown in UI and page copy */
  displayName: string
  /** One-sentence description for use in meta descriptions and page prose */
  description: string
  /** Whether this format can be a conversion source */
  isInputFormat: boolean
  /** Whether this format can be a conversion target */
  isOutputFormat: boolean
}

/** Metadata for every ValidFormat value. */
export const FORMAT_META: Record<ValidFormat, FormatMeta> = {
  [ValidFormat.Png]: {
    displayName: 'PNG',
    description: 'Lossless, transparent-capable format ideal for graphics and screenshots.',
    isInputFormat: true,
    isOutputFormat: true,
  },
  [ValidFormat.Jpeg]: {
    displayName: 'JPEG',
    description: 'Lossy format optimized for photographs with excellent compression.',
    isInputFormat: true,
    isOutputFormat: true,
  },
  [ValidFormat.WebP]: {
    displayName: 'WebP',
    description: 'Modern Google format with both lossy and lossless modes.',
    isInputFormat: true,
    isOutputFormat: true,
  },
  [ValidFormat.Gif]: {
    displayName: 'GIF',
    description: 'Supports animation and simple transparency.',
    isInputFormat: true,
    isOutputFormat: true,
  },
  [ValidFormat.Bmp]: {
    displayName: 'BMP',
    description: 'Uncompressed bitmap with universal compatibility.',
    isInputFormat: true,
    isOutputFormat: true,
  },
  [ValidFormat.Qoi]: {
    displayName: 'QOI',
    description: 'Fast lossless modern format — 3–10× faster than PNG encode/decode.',
    isInputFormat: true,
    isOutputFormat: true,
  },
  [ValidFormat.Ico]: {
    displayName: 'ICO',
    description: 'Windows icon format used for favicons and application icons.',
    isInputFormat: true,
    isOutputFormat: true,
  },
  [ValidFormat.Tiff]: {
    displayName: 'TIFF',
    description: 'High-quality lossless format used in professional and print workflows.',
    isInputFormat: true,
    isOutputFormat: true,
  },
  [ValidFormat.Tga]: {
    displayName: 'TGA',
    description: 'Legacy graphics/game industry format.',
    isInputFormat: false,
    isOutputFormat: true,
  },
}

/** Metadata for HEIC — input-only, not part of ValidFormat. */
export const HEIC_META: FormatMeta = {
  displayName: 'HEIC',
  description:
    "Apple's default iPhone camera format. Accepted as input — convert to any supported format.",
  isInputFormat: true,
  isOutputFormat: false,
}

/** A single format conversion pair with all SEO and display metadata. */
export interface FormatPair {
  /** Source format — a ValidFormat value or 'heic' for HEIC source pages */
  from: InputFormat
  to: ValidFormat
  slug: string
  title: string
  description: string
  canonical: string
  h1: string
  fromMeta: FormatMeta
  toMeta: FormatMeta
}

import { BASE_URL } from '../constants'

/**
 * Builds the complete list of format conversion pairs.
 * Excludes self-converting pairs (from === to), TGA as source, and any
 * format where isInputFormat or isOutputFormat is false.
 * Appends 9 HEIC-source pairs at the end.
 */
export function buildFormatPairs(): FormatPair[] {
  const pairs: FormatPair[] = []

  for (const from of Object.values(ValidFormat)) {
    if (!FORMAT_META[from].isInputFormat) {
      continue
    }
    for (const to of Object.values(ValidFormat)) {
      if (!FORMAT_META[to].isOutputFormat) {
        continue
      }
      if (from === to) {
        continue
      }

      const fromMeta = FORMAT_META[from]
      const toMeta = FORMAT_META[to]
      const slug = `${from}-to-${to}`

      pairs.push({
        from,
        to,
        slug,
        title: `Convert ${fromMeta.displayName} to ${toMeta.displayName} Online — Free & Private | Image Toolz`,
        description: `Convert ${fromMeta.displayName} to ${toMeta.displayName} instantly in your browser. No upload to any server — 100% private, free, and fast. Supports files up to 200 MB.`,
        canonical: `${BASE_URL}/${slug}`,
        h1: `${fromMeta.displayName} to ${toMeta.displayName} Converter`,
        fromMeta,
        toMeta,
      })
    }
  }

  // Append 9 HEIC-source pairs (one for each ValidFormat output)
  for (const to of Object.values(ValidFormat)) {
    if (!FORMAT_META[to].isOutputFormat) {
      continue
    }

    const toMeta = FORMAT_META[to]
    const slug = `heic-to-${to}`

    pairs.push({
      from: 'heic',
      to,
      slug,
      title: `Convert HEIC to ${toMeta.displayName} Online — Free & Private | Image Toolz`,
      description: `Convert HEIC to ${toMeta.displayName} instantly in your browser. No upload to any server — 100% private, free, and fast. Supports files up to 200 MB.`,
      canonical: `${BASE_URL}/${slug}`,
      h1: `HEIC to ${toMeta.displayName} Converter`,
      fromMeta: HEIC_META,
      toMeta,
    })
  }

  return pairs
}
