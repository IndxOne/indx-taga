import { describe, expect, it, vi } from 'vitest'
import { DemoRideService, SupabaseRideService } from './rideService'

const validInput = {
  pickup: { label: 'Cocody, Riviera 3', lat: 5.34, lng: -4.01 },
  destination: { label: 'Plateau, Imm. CAISTAB', lat: 5.32, lng: -4.02 },
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
    })
    expect(rpc).toHaveBeenCalledWith('create_ride', {
      p_pickup: validInput.pickup,
      p_destination: validInput.destination,
      p_ride_type: 'go',
      p_scheduled_at: null,
    })
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
})

describe('DemoRideService', () => {
  it('conserve un parcours local sans introduire de logique métier React', async () => {
    const result = await new DemoRideService().createRide(validInput)

    expect(result).toMatchObject({
      passengerId: 'demo-passenger',
      status: 'requested',
      estimatedPrice: null,
      rideType: 'go',
    })
    expect(result.id).toMatch(/^demo-ride-/)
  })
})
