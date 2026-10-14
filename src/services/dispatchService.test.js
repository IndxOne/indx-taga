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
      estimatedPrice: null,
      price: null,
      driverEarning: null,
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

  it('lit la disponibilité serveur du chauffeur (offline, available, on_ride)', async () => {
    for (const status of ['offline', 'available', 'on_ride']) {
      const query = {
        select: vi.fn(() => query),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { user_id: 'driver-1', availability_status: status, available_since: null, updated_at: '2026-09-02T10:00:00.000Z' },
          error: null,
        }),
      }
      const from = vi.fn(() => query)
      const service = new SupabaseDispatchService({ client: { from } })

      await expect(service.getDriverAvailability()).resolves.toMatchObject({
        availabilityStatus: status,
        available: status === 'available',
      })
      expect(from).toHaveBeenCalledWith('driver_profiles')
    }
  })

  it('refuse une disponibilité serveur invalide ou un profil absent', async () => {
    const make = (result) => {
      const query = { select: vi.fn(() => query), maybeSingle: vi.fn().mockResolvedValue(result) }
      return new SupabaseDispatchService({ client: { from: () => query } })
    }

    await expect(make({ data: { user_id: 'd', availability_status: 'busy' }, error: null }).getDriverAvailability())
      .rejects.toMatchObject({ code: 'invalid_dispatch_response' })
    await expect(make({ data: null, error: null }).getDriverAvailability())
      .rejects.toMatchObject({ code: 'driver_profile_missing' })
    await expect(make({ data: null, error: { code: '42501', message: 'denied' } }).getDriverAvailability())
      .rejects.toEqual({ code: '42501', message: 'denied' })
  })

  it('délègue chaque transition chauffeur à la RPC serveur', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { id: 'ride-1', passenger_id: 'passenger-1', driver_id: 'driver-1', status: 'arriving' },
      error: null,
    })
    const service = new SupabaseDispatchService({ client: { rpc } })

    await expect(service.advanceRide('ride-1', 'arriving')).resolves.toMatchObject({
      id: 'ride-1',
      status: 'arriving',
      driverId: 'driver-1',
      price: null,
      driverEarning: null,
    })
    expect(rpc).toHaveBeenCalledWith('advance_driver_ride', { p_ride_id: 'ride-1', p_to_status: 'arriving' })
  })

  it('refuse côté client les statuts hors chaîne chauffeur sans appeler le serveur', async () => {
    const rpc = vi.fn()
    const service = new SupabaseDispatchService({ client: { rpc } })

    for (const status of ['assigned', 'cancelled', 'searching', '', undefined]) {
      await expect(service.advanceRide('ride-1', status)).rejects.toMatchObject({ code: 'invalid_dispatch_input' })
    }
    await expect(service.advanceRide('', 'arriving')).rejects.toMatchObject({ code: 'invalid_dispatch_input' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('propage le refus serveur d’une transition illégale', async () => {
    const backendError = { code: '55000', message: 'Transition de course interdite : assigned vers completed.' }
    const rpc = vi.fn().mockResolvedValue({ data: null, error: backendError })
    const service = new SupabaseDispatchService({ client: { rpc } })

    await expect(service.advanceRide('ride-1', 'completed')).rejects.toEqual(backendError)
  })
})
