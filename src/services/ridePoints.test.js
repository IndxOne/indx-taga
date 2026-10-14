import { describe, expect, it } from 'vitest'
import { describeRidePointProblem, isTrustedRidePoint, toRpcPoint, TRUSTED_POINT_SOURCES } from './ridePoints'

const point = { label: 'Cocody', lat: 5.34, lng: -4.01, source: 'device_gps' }

describe('ridePoints — contrat des points de course réels', () => {
  it('accepte un point complet de provenance fiable', () => {
    expect(isTrustedRidePoint(point)).toBe(true)
    for (const source of TRUSTED_POINT_SOURCES) expect(isTrustedRidePoint({ ...point, source })).toBe(true)
  })

  it.each([
    [null, 'point manquant'],
    [undefined, 'point manquant'],
    ['Cocody', 'point manquant'],
    [{ ...point, label: undefined }, 'libellé manquant'],
    [{ ...point, label: '  ' }, 'libellé manquant'],
    [{ ...point, lat: undefined }, 'latitude invalide'],
    [{ ...point, lat: -90.1 }, 'latitude invalide'],
    [{ ...point, lng: undefined }, 'longitude invalide'],
    [{ ...point, lng: 180.1 }, 'longitude invalide'],
    [{ ...point, lat: 0, lng: 0 }, 'coordonnées nulles'],
    [{ ...point, source: undefined }, 'provenance non fiable'],
    [{ ...point, source: 'demo' }, 'provenance non fiable'],
  ])('refuse %j (%s)', (input, problem) => {
    expect(isTrustedRidePoint(input)).toBe(false)
    expect(describeRidePointProblem(input)).toBe(problem)
  })

  it('n’envoie jamais la provenance à la RPC', () => {
    expect(toRpcPoint({ ...point, label: ' Cocody ' })).toEqual({ label: 'Cocody', lat: 5.34, lng: -4.01 })
  })
})
