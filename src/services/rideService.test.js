import { describe, expect, it, vi } from 'vitest'
import { DemoRideService, SupabaseRideService } from './rideService'

const validInput = {
  pickup: { label: 'Cocody, Riviera 3', lat: 5.34, lng: -4.01, source: 'device_gps' },
  destination: { label: 'Plateau, Imm. CAISTAB', lat: 5.32, lng: -4.02, source: 'address_selection' },
  ride_type: 'go',
  scheduled_at: null,
}

const databaseRide = {
  id: 'ride-1',
  passenger_id: 'passenger-1',
  pickup_label: 'Cocody, Riviera 3',
  pickup_lat: 5.34,
  pickup_lng: -4.01,
  destination_label: 'Plateau, Imm. CAISTAB',
  destination_lat: 5.32,
  destination_lng: -4.02,
  ride_type: 'go',
  scheduled_at: null,
  status: 'requested',
  estimated_price: null,
  created_at: '2026-09-02T10:00:00.000Z',
  updated_at: '2026-09-02T10:00:00.000Z',
}

describe('SupabaseRideService', () => {
  it('n’appelle pas la RPC avec des champs serveur', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: databaseRide, error: null })
    const service = new SupabaseRideService({ client: { rpc } })

    await expect(service.createRide({ ...validInput, passenger_id: 'attacker-id' })).rejects.toMatchObject({ code: 'invalid_ride_input' })
    await expect(service.createRide({ ...validInput, status: 'completed' })).rejects.toMatchObject({ code: 'invalid_ride_input' })
    await expect(service.createRide({ ...validInput, estimated_price: 42 })).rejects.toMatchObject({ code: 'invalid_ride_input' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('retourne le contrat applicatif issu de la réponse backend', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: databaseRide, error: null })
    const service = new SupabaseRideService({ client: { rpc } })

    await expect(service.createRide(validInput)).resolves.toMatchObject({
      id: 'ride-1',
      passengerId: 'passenger-1',
      status: 'requested',
      estimatedPrice: null,
      price: null,
      driverEarning: null,
    })
    expect(rpc).toHaveBeenCalledWith('create_ride', {
      // La provenance reste côté client : seule la forme libellé + coordonnées part à la RPC.
      p_pickup: { label: 'Cocody, Riviera 3', lat: 5.34, lng: -4.01 },
      p_destination: { label: 'Plateau, Imm. CAISTAB', lat: 5.32, lng: -4.02 },
      p_ride_type: 'go',
      p_scheduled_at: null,
    })
  })

  it('conserve le prix serveur sans appliquer de tarif de repli', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ...databaseRide, estimated_price: 3250 }, error: null })
    const service = new SupabaseRideService({ client: { rpc } })

    await expect(service.createRide(validInput)).resolves.toMatchObject({
      estimatedPrice: 3250,
      price: 3250,
      driverEarning: null,
    })
  })

  it('refuse sans appel RPC les points absents, incomplets, invalides ou de provenance non fiable', async () => {
    const rpc = vi.fn()
    const service = new SupabaseRideService({ client: { rpc } })
    const good = validInput.pickup
    const cases = {
      'départ absent': { ...validInput, pickup: undefined },
      'destination absente': { ...validInput, destination: null },
      'libellés seuls (chaînes de démo)': { ...validInput, pickup: 'Cocody, Riviera 3', destination: 'Plateau, Imm. CAISTAB' },
      'libellé seul sans coordonnées': { ...validInput, pickup: { label: 'Cocody, Riviera 3', source: 'device_gps' } },
      'latitude manquante': { ...validInput, pickup: { ...good, lat: undefined } },
      'longitude manquante': { ...validInput, destination: { ...validInput.destination, lng: undefined } },
      'latitude hors plage': { ...validInput, pickup: { ...good, lat: 91 } },
      'longitude hors plage': { ...validInput, pickup: { ...good, lng: -181 } },
      'latitude NaN': { ...validInput, pickup: { ...good, lat: Number.NaN } },
      'longitude Infinity': { ...validInput, destination: { ...validInput.destination, lng: Infinity } },
      'coordonnées en chaîne': { ...validInput, pickup: { ...good, lat: '5.34' } },
      'coordonnées 0,0': { ...validInput, pickup: { ...good, lat: 0, lng: 0 } },
      'libellé vide': { ...validInput, pickup: { ...good, label: '   ' } },
      'libellé trop long': { ...validInput, destination: { ...validInput.destination, label: 'x'.repeat(241) } },
      'provenance absente': { ...validInput, pickup: { label: good.label, lat: good.lat, lng: good.lng } },
      'provenance inconnue': { ...validInput, pickup: { ...good, source: 'demo' } },
    }

    for (const [name, input] of Object.entries(cases)) {
      await expect(service.createRide(input), name).rejects.toMatchObject({ code: 'invalid_ride_input' })
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it('propage les erreurs backend', async () => {
    const backendError = { code: '42501', message: 'Seul un passager actif peut créer une course.' }
    const service = new SupabaseRideService({
      client: { rpc: vi.fn().mockResolvedValue({ data: null, error: backendError }) },
    })

    await expect(service.createRide(validInput)).rejects.toEqual(backendError)
  })

  it('laisse le backend refuser une session absente ou un rôle non autorisé', async () => {
    for (const backendError of [
      { code: '28000', message: 'Une session est nécessaire pour créer une course.' },
      { code: '42501', message: 'Seul un passager actif peut créer une course.' },
    ]) {
      const service = new SupabaseRideService({
        client: { rpc: vi.fn().mockResolvedValue({ data: null, error: backendError }) },
      })

      await expect(service.createRide(validInput)).rejects.toEqual(backendError)
    }
  })

  it('utilise le prix renvoyé par le backend et jamais une valeur client', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ...databaseRide, estimated_price: 3250 },
      error: null,
    })
    const service = new SupabaseRideService({ client: { rpc } })

    await expect(service.createRide(validInput)).resolves.toMatchObject({ estimatedPrice: 3250 })
    expect(rpc.mock.calls[0][1]).not.toHaveProperty('p_estimated_price')
  })

  it('normalise une date planifiée avant de l’envoyer au backend', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: databaseRide, error: null })
    const service = new SupabaseRideService({ client: { rpc } })

    await service.createRide({ ...validInput, scheduled_at: '2026-12-20T10:00:00+00:00' })

    expect(rpc.mock.calls[0][1].p_scheduled_at).toBe('2026-12-20T10:00:00.000Z')
  })

  it('annule la recherche via une RPC serveur dédiée', async () => {
    const cancelledRide = { ...databaseRide, status: 'cancelled' }
    const rpc = vi.fn().mockResolvedValue({ data: cancelledRide, error: null })
    const service = new SupabaseRideService({ client: { rpc } })

    await expect(service.cancelRideSearch('ride-1')).resolves.toMatchObject({ id: 'ride-1', status: 'cancelled' })
    expect(rpc).toHaveBeenCalledWith('cancel_ride_search', { p_ride_id: 'ride-1' })
  })

  it('relance la recherche uniquement via le contrat serveur', async () => {
    const retriedRide = { ...databaseRide, status: 'requested' }
    const rpc = vi.fn().mockResolvedValue({ data: retriedRide, error: null })
    const service = new SupabaseRideService({ client: { rpc } })

    await expect(service.retryRideSearch('ride-1')).resolves.toMatchObject({ id: 'ride-1', status: 'requested' })
    expect(rpc).toHaveBeenCalledWith('retry_ride_search', { p_ride_id: 'ride-1' })
  })
})

describe('DemoRideService', () => {
  it('conserve un parcours local sans introduire de logique métier React', async () => {
    const result = await new DemoRideService().createRide(validInput)

    expect(result).toMatchObject({
      passengerId: 'demo-passenger',
      status: 'requested',
      estimatedPrice: 3200,
      price: 3200,
      driverEarning: 2720,
      rideType: 'go',
    })
    expect(result.id).toMatch(/^demo-ride-/)
  })
})
