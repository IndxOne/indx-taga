import { describe, expect, it } from 'vitest'
import { resolveMapProvider } from './mapProvider'

describe('MapProvider', () => {
  it('utilise SVG comme fournisseur de Lot 4A', () => {
    expect(resolveMapProvider('svg')).toEqual({ requested: 'svg', provider: 'svg', fallback: false })
  })

  it('signale le fallback pour un fournisseur non encore implémenté', () => {
    expect(resolveMapProvider('google')).toEqual({ requested: 'google', provider: 'svg', fallback: true })
  })
})
