import { describe, expect, it } from 'vitest'
import { getRidePricing, getServerRideMoney, normalizeRideFare } from './rideFare'

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

  it('mode réel : aucun tarif de repli quand le serveur n’a pas fourni d’estimation', () => {
    const unknown = { estimatedPrice: null, finalPrice: null, driverEarning: null, paymentStatus: null }
    for (const value of [null, undefined, Number.NaN, -1, '  ', 'abc', Infinity, {}]) {
      expect(getServerRideMoney(value)).toEqual(unknown)
    }
  })

  it('mode réel : estimation, prix final, gain et paiement sont quatre notions distinctes', () => {
    expect(getServerRideMoney(3250)).toEqual({ estimatedPrice: 3250, finalPrice: null, driverEarning: null, paymentStatus: null })
    expect(getServerRideMoney('4000')).toMatchObject({ estimatedPrice: 4000, finalPrice: null })
    expect(getServerRideMoney(0)).toMatchObject({ estimatedPrice: 0, finalPrice: null })
    expect(getServerRideMoney(3250)).not.toHaveProperty('price')
  })

  it('mode réel : une estimation n’est jamais copiée en prix final, en gain ni en paiement', () => {
    for (const estimate of [0, 1900, 3200, 3250, 4500, '3250']) {
      const money = getServerRideMoney(estimate)
      expect(money.finalPrice).toBeNull()
      expect(money.driverEarning).toBeNull()
      expect(money.paymentStatus).toBeNull()
    }
    expect(JSON.stringify(getServerRideMoney(3250))).not.toContain('2763')
  })

  it('démo : le calcul fictif du gain est conservé', () => {
    expect(getRidePricing(3250, 'go').driverEarning).toBe(2763)
  })
})
