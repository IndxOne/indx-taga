import { describe, expect, it } from 'vitest'
import { getRidePricing, getServerRidePricing, normalizeRideFare } from './rideFare'

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

  it('mode réel : aucun tarif de repli quand le serveur n’a pas fixé le prix', () => {
    const unknown = { estimatedPrice: null, price: null, driverEarning: null }
    expect(getServerRidePricing(null)).toEqual(unknown)
    expect(getServerRidePricing(undefined)).toEqual(unknown)
    expect(getServerRidePricing(Number.NaN)).toEqual(unknown)
    expect(getServerRidePricing(-1)).toEqual(unknown)
    expect(getServerRidePricing('  ')).toEqual(unknown)
  })

  it('mode réel : conserve un prix serveur valide, y compris zéro', () => {
    expect(getServerRidePricing(3250)).toEqual({ estimatedPrice: 3250, price: 3250, driverEarning: null })
    expect(getServerRidePricing('4000')).toMatchObject({ price: 4000 })
    expect(getServerRidePricing(0)).toMatchObject({ price: 0 })
  })

  it('mode réel : le gain chauffeur n’est jamais déduit d’un pourcentage frontend', () => {
    for (const price of [0, 1900, 3200, 3250, 4500, '3250']) {
      expect(getServerRidePricing(price).driverEarning).toBeNull()
    }
    expect(JSON.stringify(getServerRidePricing(3250))).not.toContain('2763')
  })

  it('démo : le calcul fictif du gain est conservé', () => {
    expect(getRidePricing(3250, 'go').driverEarning).toBe(2763)
  })
})
