import { describe, expect, it, vi } from 'vitest'
import { getDriverLocationRemainingMs, SupabaseRideRealtimeService } from './rideRealtimeService'

const rideRow = {
  id: 'ride-1',
  passenger_id: 'passenger-1',
  driver_id: 'driver-1',
  pickup_label: 'Cocody',
  pickup_lat: 5.34,
  pickup_lng: -4.01,
  destination_label: 'Plateau',
  destination_lat: 5.32,
  destination_lng: -4.02,
  ride_type: 'go',
  scheduled_at: null,
  status: 'assigned',
  estimated_price: null,
  assigned_at: '2026-09-02T10:00:00.000Z',
  dispatch_deadline_at: null,
  created_at: '2026-09-02T09:59:00.000Z',
  updated_at: '2026-09-02T10:00:00.000Z',
}

function queryChain(result) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    gte: vi.fn(() => query),
    in: vi.fn(() => query),
    not: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  }
  return query
}

describe('SupabaseRideRealtimeService', () => {
  it('calcule le délai avant de retirer une position', () => {
    const location = { recordedAt: '2026-09-02T10:01:30.000Z' }
    expect(getDriverLocationRemainingMs(location, { now: Date.parse('2026-09-02T10:01:45.000Z') })).toBe(45_000)
    expect(getDriverLocationRemainingMs(location, { now: Date.parse('2026-09-02T10:02:31.000Z') })).toBe(0)
  })

  it('lit la course et la dernière position via les tables protégées', async () => {
    const rideQuery = queryChain({ data: rideRow, error: null })
    const locationQuery = queryChain({
      data: {
        ride_id: 'ride-1', driver_id: 'driver-1', latitude: 5.35, longitude: -4.02,
        accuracy_m: 8, heading_deg: null, speed_mps: 5, recorded_at: '2026-09-02T10:01:00.000Z', updated_at: '2026-09-02T10:01:00.000Z',
      },
      error: null,
    })
    const client = {
      from: vi.fn()
        .mockReturnValueOnce(rideQuery)
        .mockReturnValueOnce(locationQuery),
    }
    const service = new SupabaseRideRealtimeService({ client })

    await expect(service.getRide('ride-1')).resolves.toMatchObject({ id: 'ride-1', status: 'assigned', driverId: 'driver-1' })
    await expect(service.getDriverLocation('ride-1', { now: Date.parse('2026-09-02T10:01:30.000Z') })).resolves.toMatchObject({ rideId: 'ride-1', lat: 5.35, lng: -4.02 })
    expect(rideQuery.eq).toHaveBeenCalledWith('id', 'ride-1')
    expect(locationQuery.eq).toHaveBeenCalledWith('ride_id', 'ride-1')
    expect(locationQuery.gte).toHaveBeenCalledWith('recorded_at', '2026-09-02T10:00:30.000Z')
  })

  it('restaure la dernière course active après un rechargement', async () => {
    const rideQuery = queryChain({ data: { ...rideRow, status: 'searching', driver_id: null }, error: null })
    const service = new SupabaseRideRealtimeService({ client: { from: vi.fn(() => rideQuery) } })

    await expect(service.getActiveRide()).resolves.toMatchObject({
      id: 'ride-1',
      status: 'searching',
      driverId: null,
      estimatedPrice: null,
      price: null,
      driverEarning: null,
    })
    expect(rideQuery.in).toHaveBeenCalledWith('status', ['requested', 'searching', 'assigned', 'arriving', 'arrived', 'in_progress', 'no_driver'])
    expect(rideQuery.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(rideQuery.limit).toHaveBeenCalledWith(1)
  })

  it('restaure la course active du chauffeur affecté après un rechargement', async () => {
    const rideQuery = queryChain({ data: { ...rideRow, status: 'arrived' }, error: null })
    const service = new SupabaseRideRealtimeService({ client: { from: vi.fn(() => rideQuery) } })

    await expect(service.getActiveDriverRide()).resolves.toMatchObject({
      id: 'ride-1',
      status: 'arrived',
      driverId: 'driver-1',
      price: null,
    })
    expect(rideQuery.not).toHaveBeenCalledWith('driver_id', 'is', null)
    expect(rideQuery.in).toHaveBeenCalledWith('status', ['assigned', 'arriving', 'arrived', 'in_progress'])
  })

  it('renvoie null quand le chauffeur n’a aucune course active', async () => {
    const rideQuery = queryChain({ data: null, error: null })
    const service = new SupabaseRideRealtimeService({ client: { from: vi.fn(() => rideQuery) } })

    await expect(service.getActiveDriverRide()).resolves.toBeNull()
  })

  describe('getCompletedRide', () => {
    const completedRow = { ...rideRow, status: 'completed' }
    const clientWith = (rideQuery, userId = 'passenger-1') => ({
      from: vi.fn(() => rideQuery),
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: userId ? { user: { id: userId } } : null }, error: null }) },
    })

    it('lit la course terminée par identifiant et statut, distincte de la course active', async () => {
      const rideQuery = queryChain({ data: completedRow, error: null })
      const service = new SupabaseRideRealtimeService({ client: clientWith(rideQuery) })

      await expect(service.getCompletedRide('ride-1')).resolves.toMatchObject({ id: 'ride-1', status: 'completed', passengerId: 'passenger-1' })
      expect(rideQuery.eq).toHaveBeenCalledWith('id', 'ride-1')
      expect(rideQuery.eq).toHaveBeenCalledWith('status', 'completed')
      expect(rideQuery.in).not.toHaveBeenCalled()
    })

    it('renvoie null si la course n’est pas visible (autre passager filtré par la RLS, non terminée)', async () => {
      const service = new SupabaseRideRealtimeService({ client: clientWith(queryChain({ data: null, error: null })) })

      await expect(service.getCompletedRide('ride-autre')).resolves.toBeNull()
    })

    it('refuse une course d’un autre passager même si elle était renvoyée (seconde barrière)', async () => {
      const service = new SupabaseRideRealtimeService({ client: clientWith(queryChain({ data: completedRow, error: null }), 'intrus') })

      await expect(service.getCompletedRide('ride-1')).rejects.toMatchObject({ code: 'forbidden' })
    })

    it('exige une session avant toute lecture', async () => {
      const rideQuery = queryChain({ data: completedRow, error: null })
      const service = new SupabaseRideRealtimeService({ client: clientWith(rideQuery, null) })

      await expect(service.getCompletedRide('ride-1')).rejects.toMatchObject({ code: 'unauthenticated' })
      expect(rideQuery.select).not.toHaveBeenCalled()
    })

    it('propage les erreurs backend et refuse un identifiant invalide', async () => {
      const backendError = { code: '42501', message: 'denied' }
      const service = new SupabaseRideRealtimeService({ client: clientWith(queryChain({ data: null, error: backendError })) })

      await expect(service.getCompletedRide('ride-1')).rejects.toEqual(backendError)
      await expect(service.getCompletedRide('')).rejects.toMatchObject({ code: 'invalid_realtime_input' })
      await expect(service.getCompletedRide('a,b')).rejects.toMatchObject({ code: 'invalid_realtime_input' })
    })
  })

  it('récupère l’offre active du chauffeur avec la course associée', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        offer: {
          id: 'offer-1', ride_id: 'ride-1', driver_id: 'driver-1', status: 'offered',
          offered_at: '2026-09-02T10:00:00.000Z', expires_at: '2026-09-02T10:00:30.000Z',
          responded_at: null, created_at: '2026-09-02T10:00:00.000Z',
        },
        ride: { ...rideRow, status: 'searching', driver_id: null },
      },
      error: null,
    })
    const service = new SupabaseRideRealtimeService({ client: { rpc } })

    await expect(service.getActiveDriverOffer()).resolves.toMatchObject({
      id: 'offer-1',
      rideId: 'ride-1',
      ride: { id: 'ride-1', status: 'searching' },
    })
    expect(rpc).toHaveBeenCalledWith('get_driver_active_offer')
  })

  it('abonne le passager aux changements de course et de position', async () => {
    const handlers = []
    const unsubscribe = vi.fn()
    const channel = {
      on: vi.fn((_event, filter, handler) => {
        handlers.push({ filter, handler })
        return channel
      }),
      subscribe: vi.fn((callback) => {
        callback('SUBSCRIBED')
        return channel
      }),
      unsubscribe,
    }
    const client = { channel: vi.fn(() => channel) }
    const onRideChange = vi.fn()
    const onDriverLocationChange = vi.fn()
    const service = new SupabaseRideRealtimeService({ client })

    const stop = service.subscribeToRide('ride-1', { onRideChange, onDriverLocationChange, now: () => Date.parse('2026-09-02T10:01:30.000Z') })
    await Promise.resolve()
    expect(client.channel).toHaveBeenCalledWith('taga:ride:ride-1')
    expect(handlers[0].filter).toMatchObject({ table: 'rides', event: 'UPDATE', filter: 'id=eq.ride-1' })
    expect(handlers[1].filter).toMatchObject({ table: 'driver_locations', event: '*', filter: 'ride_id=eq.ride-1' })

    handlers[0].handler({ new: rideRow })
    handlers[1].handler({ eventType: 'UPDATE', new: { ride_id: 'ride-1', driver_id: 'driver-1', latitude: 5.3, longitude: -4, recorded_at: '2026-09-02T10:01:00.000Z' } })
    expect(onRideChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'assigned' }))
    expect(onDriverLocationChange).toHaveBeenCalledWith(expect.objectContaining({ lat: 5.3, lng: -4 }))

    stop()
    expect(unsubscribe).toHaveBeenCalled()
  })

  it('abonne le chauffeur aux changements d’offres', async () => {
    const handlers = []
    const unsubscribe = vi.fn()
    const channel = {
      on: vi.fn((_event, filter, handler) => {
        handlers.push({ filter, handler })
        return channel
      }),
      subscribe: vi.fn(() => channel),
      unsubscribe,
    }
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    const onOfferChange = vi.fn()
    const service = new SupabaseRideRealtimeService({ client: { channel: vi.fn(() => channel), rpc } })

    const stop = service.subscribeToDriverOffers({ onOfferChange })
    await Promise.resolve()
    expect(handlers[0].filter).toMatchObject({ table: 'ride_dispatch_offers', event: '*' })

    handlers[0].handler({ new: { id: 'offer-1' } })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(onOfferChange).toHaveBeenCalledWith(null)

    stop()
    expect(unsubscribe).toHaveBeenCalled()
  })

  it('écarte une position ancienne et efface la position à la suppression', async () => {
    const handlers = []
    const channel = {
      on: vi.fn((_event, filter, handler) => {
        handlers.push({ filter, handler })
        return channel
      }),
      subscribe: vi.fn(() => channel),
      unsubscribe: vi.fn(),
    }
    const service = new SupabaseRideRealtimeService({ client: { channel: vi.fn(() => channel) } })
    const onDriverLocationChange = vi.fn()
    const stop = service.subscribeToRide('ride-1', {
      onDriverLocationChange,
      now: () => Date.parse('2026-09-02T10:02:01.000Z'),
    })
    await Promise.resolve()

    handlers[1].handler({ eventType: 'UPDATE', new: {
      ride_id: 'ride-1', driver_id: 'driver-1', latitude: 5.3, longitude: -4,
      recorded_at: '2026-09-02T10:00:00.000Z',
    } })
    handlers[1].handler({ eventType: 'DELETE', old: { ride_id: 'ride-1' } })

    expect(onDriverLocationChange).toHaveBeenNthCalledWith(1, null)
    expect(onDriverLocationChange).toHaveBeenNthCalledWith(2, null)
    stop()
  })

  it('efface la position quand la course devient terminée', async () => {
    const handlers = []
    const channel = {
      on: vi.fn((_event, filter, handler) => {
        handlers.push({ filter, handler })
        return channel
      }),
      subscribe: vi.fn(() => channel),
      unsubscribe: vi.fn(),
    }
    const service = new SupabaseRideRealtimeService({ client: { channel: vi.fn(() => channel) } })
    const onDriverLocationChange = vi.fn()
    const stop = service.subscribeToRide('ride-1', {
      onDriverLocationChange,
      now: () => Date.parse('2026-09-02T10:02:01.000Z'),
    })
    await Promise.resolve()

    handlers[1].handler({ eventType: 'UPDATE', new: { ride_id: 'ride-1', driver_id: 'driver-1', latitude: 5.3, longitude: -4, recorded_at: '2026-09-02T10:02:00.000Z' } })
    handlers[0].handler({ new: { ...rideRow, status: 'completed' } })
    handlers[1].handler({ eventType: 'UPDATE', new: { ride_id: 'ride-1', driver_id: 'driver-1', latitude: 5.31, longitude: -4.01, recorded_at: '2026-09-02T10:02:00.000Z' } })

    expect(onDriverLocationChange).toHaveBeenCalledWith(null)
    expect(onDriverLocationChange).toHaveBeenCalledTimes(2)
    stop()
  })

  it('ne renvoie pas une position obsolète lors de la lecture initiale', async () => {
    const locationQuery = queryChain({
      data: {
        ride_id: 'ride-1', driver_id: 'driver-1', latitude: 5.35, longitude: -4.02,
        recorded_at: '2026-09-02T09:59:00.000Z', updated_at: '2026-09-02T09:59:00.000Z',
      },
      error: null,
    })
    const service = new SupabaseRideRealtimeService({
      client: { from: vi.fn(() => locationQuery) },
    })

    await expect(service.getDriverLocation('ride-1', {
      now: Date.parse('2026-09-02T10:02:00.000Z'),
    })).resolves.toBeNull()
  })

  it('refuse un identifiant pouvant altérer le filtre Realtime', () => {
    const service = new SupabaseRideRealtimeService({ client: {} })
    expect(() => service.subscribeToRide('ride-1,driver_id=eq.driver-2')).toThrow('identifiant')
  })
})
