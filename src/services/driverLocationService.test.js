import { describe, expect, it, vi } from 'vitest'
import { SupabaseDriverLocationService } from './driverLocationService'

describe('SupabaseDriverLocationService', () => {
  it('publie une position via la RPC sans horodatage fourni par le client', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ride_id: 'ride-1' }, error: null })
    const service = new SupabaseDriverLocationService({ client: { rpc } })

    await expect(service.publishDriverLocation('ride-1', {
      lat: 5.34,
      lng: -4.01,
      accuracyM: 9,
      headingDeg: 180,
      speedMps: 7,
      timestamp: 123,
    })).resolves.toMatchObject({ ride_id: 'ride-1' })

    expect(rpc).toHaveBeenCalledWith('publish_driver_location', {
      p_ride_id: 'ride-1',
      p_latitude: 5.34,
      p_longitude: -4.01,
      p_accuracy_m: 9,
      p_heading_deg: 180,
      p_speed_mps: 7,
    })
    expect(rpc.mock.calls[0][1]).not.toHaveProperty('p_recorded_at')
  })

  it('ne publie pas de coordonnées invalides', async () => {
    const rpc = vi.fn()
    const service = new SupabaseDriverLocationService({ client: { rpc } })

    await expect(service.publishDriverLocation('ride-1', { lat: 91, lng: 0 })).rejects.toMatchObject({ code: 'invalid_location_input' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('arrête le suivi navigateur et conserve une seule publication en vol', async () => {
    let onPosition
    const stopWatch = vi.fn()
    const watchPosition = vi.fn((success) => {
      onPosition = success
      return stopWatch
    })
    let resolveRpc
    const rpc = vi.fn(() => new Promise((resolve) => { resolveRpc = resolve }))
    const service = new SupabaseDriverLocationService({
      client: { rpc },
      geolocation: { watchPosition },
      minPublishIntervalMs: 0,
    })

    const onLocation = vi.fn()
    const stop = service.watchAndPublish({ rideId: 'ride-1', onLocation })
    onPosition({ lat: 5.1, lng: -4.1, accuracyM: 10 })
    onPosition({ lat: 5.2, lng: -4.2, accuracyM: 11 })
    await Promise.resolve()
    expect(rpc).toHaveBeenCalledTimes(1)

    resolveRpc({ data: { ride_id: 'ride-1' }, error: null })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(rpc).toHaveBeenCalledTimes(2)
    stop()
    expect(stopWatch).toHaveBeenCalled()
    expect(onLocation).toHaveBeenCalledTimes(2)
  })
})
