import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getCurrentPosition,
  normalizeBrowserPosition,
  normalizeGeolocationError,
  watchPosition,
} from './geolocationService'

describe('geolocationService', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('normalise une position navigateur sans perdre les métadonnées utiles', () => {
    expect(normalizeBrowserPosition({
      timestamp: 1_725_000_000_000,
      coords: {
        latitude: 5.34,
        longitude: -4.01,
        accuracy: 12,
        heading: 90,
        speed: 8,
      },
    })).toEqual({
      lat: 5.34,
      lng: -4.01,
      accuracyM: 12,
      headingDeg: 90,
      speedMps: 8,
      timestamp: 1_725_000_000_000,
    })
  })

  it('refuse une position absente ou hors limites', () => {
    expect(() => normalizeBrowserPosition({ coords: { latitude: 91, longitude: 0 } })).toThrow('invalide')
    expect(normalizeGeolocationError({ code: 1 })).toMatchObject({ code: 'geolocation_permission_denied' })
  })

  it('utilise les options GPS sûres et permet d’arrêter un suivi', async () => {
    const clearWatch = vi.fn()
    const getCurrent = vi.fn((_success, _error, options) => {
      expect(options).toMatchObject({ enableHighAccuracy: true, maximumAge: 5_000, timeout: 10_000 })
      _success({ timestamp: 2, coords: { latitude: 5, longitude: -4, accuracy: null, heading: null, speed: null } })
    })
    const watch = vi.fn((success) => {
      success({ timestamp: 3, coords: { latitude: 5.1, longitude: -4.1, accuracy: 10, heading: null, speed: null } })
      return 7
    })
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: getCurrent, watchPosition: watch, clearWatch } })

    await expect(getCurrentPosition()).resolves.toMatchObject({ lat: 5, lng: -4 })
    const onSuccess = vi.fn()
    const stop = watchPosition(onSuccess, vi.fn())

    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ lat: 5.1, lng: -4.1 }))
    stop()
    expect(clearWatch).toHaveBeenCalledWith(7)
  })

  it('signale explicitement l’absence de GPS', async () => {
    vi.stubGlobal('navigator', {})
    await expect(getCurrentPosition()).rejects.toMatchObject({ code: 'geolocation_unavailable' })
  })
})
