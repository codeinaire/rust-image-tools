import { describe, it, expect } from 'vitest'
import { formatGpsCoord } from '../../src/components/MetadataPanel'

describe('formatGpsCoord', () => {
  it('formats positive latitude as North', () => {
    const result = formatGpsCoord(37.774966, true)
    expect(result).toBe('37.774966\u00b0 N')
  })

  it('formats negative latitude as South', () => {
    const result = formatGpsCoord(-33.8688, true)
    expect(result).toBe('33.868800\u00b0 S')
  })

  it('formats positive longitude as East', () => {
    const result = formatGpsCoord(151.2093, false)
    expect(result).toBe('151.209300\u00b0 E')
  })

  it('formats negative longitude as West', () => {
    const result = formatGpsCoord(-122.4194, false)
    expect(result).toBe('122.419400\u00b0 W')
  })

  it('formats zero latitude as North', () => {
    const result = formatGpsCoord(0, true)
    expect(result).toBe('0.000000\u00b0 N')
  })

  it('formats zero longitude as East', () => {
    const result = formatGpsCoord(0, false)
    expect(result).toBe('0.000000\u00b0 E')
  })

  it('uses 6 decimal places', () => {
    const result = formatGpsCoord(1.5, true)
    expect(result).toBe('1.500000\u00b0 N')
  })
})
