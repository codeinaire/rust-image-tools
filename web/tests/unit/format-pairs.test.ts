import { describe, it, expect } from 'vitest'
import { buildFormatPairs, FORMAT_META } from '../../src/data/format-pairs'
import { ValidFormat } from '../../src/types'
import formatCopy from '../../src/data/format-copy.json'

const pairs = buildFormatPairs()

describe('buildFormatPairs', () => {
  it('returns more than 0 pairs', () => {
    expect(pairs.length).toBeGreaterThan(0)
  })

  it('returns exactly 73 pairs (64 ValidFormat + 9 HEIC)', () => {
    expect(pairs.length).toBe(73)
  })

  it('has no pair where from === to', () => {
    for (const pair of pairs) {
      expect(pair.from).not.toBe(pair.to)
    }
  })

  it('never has ValidFormat.Tga as a from value', () => {
    const tgaFromPairs = pairs.filter((p) => p.from === ValidFormat.Tga)
    expect(tgaFromPairs.length).toBe(0)
  })

  it('has heic as a from value for exactly 9 pairs', () => {
    const heicPairs = pairs.filter((p) => p.from === 'heic')
    expect(heicPairs.length).toBe(9)
  })

  it('has every slug matching /^[a-z]+-to-[a-z]+$/', () => {
    const pattern = /^[a-z]+-to-[a-z]+$/
    for (const pair of pairs) {
      expect(pair.slug).toMatch(pattern)
    }
  })

  it('has no duplicate titles', () => {
    const titles = pairs.map((p) => p.title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('has no duplicate descriptions', () => {
    const descriptions = pairs.map((p) => p.description)
    expect(new Set(descriptions).size).toBe(descriptions.length)
  })

  it('has no duplicate canonicals', () => {
    const canonicals = pairs.map((p) => p.canonical)
    expect(new Set(canonicals).size).toBe(canonicals.length)
  })

  it('has every canonical starting with https://imagetoolz.app/', () => {
    for (const pair of pairs) {
      expect(pair.canonical).toMatch(/^https:\/\/imagetoolz\.app\//)
    }
  })

  it('has a corresponding entry in format-copy.json for every slug', () => {
    const copyKeys = Object.keys(formatCopy)
    for (const pair of pairs) {
      expect(copyKeys).toContain(pair.slug)
    }
  })
})
