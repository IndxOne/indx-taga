import { describe, expect, it, vi } from 'vitest'
import { DemoDispatchService, SupabaseDispatchService } from './dispatchService'

describe('SupabaseDispatchService', () => {
  it('envoie uniquement la disponibilité métier à la RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        user_id: 'driver-1',
        availability_status: 'available',
        available_since: '2026-09-02T10:00:00.000Z',
        updated_at: '2026-09-02T10:00:00.000Z',
      },
      error: null,
    })
    const service = new SupabaseDispatchService({ client: { rpc } })

    await expect(service.setDriverAvailability(true)).resolves.toMatchObject({
      userId: 'driver-1',
      availabilityStatus: 'available',
      available: true,
    })
    expect(rpc).toHaveBeenCalledWith('set_driver_availability', { p_available: true })
  })

  it('normalise le ride retourné par le dispatch serveur', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: 'ride-1',
        passenger_id: 'passenger-1',
        driver_id: null,
        status: 'searching',
        assigned_at: null,
        dispatch_deadline_at: '2026-09-02T10:02:00.000Z',
        updated_at: '2026-09-02T10:00:00.000Z',
      },
      error: null,
    })
    const service = new SupabaseDispatchService({ client: { rpc } })

    await expect(service.requestRideDispatch('ride-1')).resolves.toMatchObject({
      id: 'ride-1',
      status: 'searching',
      driverId: null,
      estimatedPrice: 3200,
      price: 3200,
      driverEarning: 2720,
    })
    expect(rpc).toHaveBeenCalledWith('request_ride_dispatch', { p_ride_id: 'ride-1' })
  })

  it('propage les refus backend et bloque les entrées invalides', async () => {
    const backendError = { code: '42501', message: 'Un véhicule actif est nécessaire.' }
    const rpc = vi.fn().mockResolvedValue({ data: null, error: backendError })
    const service = new SupabaseDispatchService({ client: { rpc } })

    await expect(service.setDriverAvailability(true)).rejects.toEqual(backendError)
    await expect(service.requestRideDispatch('')).rejects.toMatchObject({ code: 'invalid_dispatch_input' })
    await expect(service.respondToOffer('offer-1', 'maybe')).rejects.toMatchObject({ code: 'invalid_dispatch_input' })
  })
})

describe('DemoDispatchService', () => {
  it('conserve le basculement local en mode démo', async () => {
    const service = new DemoDispatchService()

    await expect(service.setDriverAvailability(true)).resolves.toMatchObject({
      availabilityStatus: 'available',
      available: true,
    })
  })
})
