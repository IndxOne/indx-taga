import { describe, expect, it } from 'vitest'
import { getRidePricing, normalizeRideFare } from './rideFare'

describe('rideFare', () => {
  it('utilise le tarif de référence de chaque type quand le backend renvoie null', () => {
    expect(normalizeRideFare(null, 'go')).toBe(3200)
    expect(normalizeRideFare(null, 'partage')).toBe(1900)
    expect(normalizeRideFare(null, 'family')).toBe(4500)
    expect(normalizeRideFare(null, 'confort')).toBe(4200)
  })

  it('conserve un tarif backend valide et calcule le gain chauffeur', () => {
    expect(getRidePricing(3250, 'go')).toEqual({
      estimatedPrice: 3250,
      price: 3250,
      driverEarning: 2763,
    })
  })

  it('écarte les valeurs non tarifaires sans produire NaN', () => {
    expect(getRidePricing(Number.NaN, 'go')).toMatchObject({ price: 3200, driverEarning: 2720 })
    expect(getRidePricing(-1, 'go')).toMatchObject({ price: 3200, driverEarning: 2720 })
    expect(getRidePricing('  ', 'go')).toMatchObject({ price: 3200, driverEarning: 2720 })
  })
})
