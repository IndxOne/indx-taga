import { getAuthService } from './authService'
import { isDemoMode, runtimeConfig } from './runtimeConfig'

export const RIDE_TYPES = Object.freeze(['go', 'partage', 'family', 'confort'])

function validationError(message) {
  const error = new Error(message)
  error.code = 'invalid_ride_input'
  return error
}

function normalizeLocation(value, fieldName) {
  const source = typeof value === 'string' ? { label: value } : value
  if (!source || typeof source !== 'object') {
    throw validationError(`Le point ${fieldName} est requis.`)
  }

  const label = String(source.label ?? '').trim()
  if (!label || label.length > 240) {
    throw validationError(`Le libellé ${fieldName} est invalide.`)
  }

  const location = { label }
  for (const coordinate of ['lat', 'lng']) {
    if (source[coordinate] == null || source[coordinate] === '') continue
    if (typeof source[coordinate] !== 'number' || !Number.isFinite(source[coordinate])) {
      throw validationError(`La coordonnée ${coordinate} de ${fieldName} est invalide.`)
    }
    location[coordinate] = source[coordinate]
  }
  return location
}

function normalizeCreateInput(input = {}) {
  for (const serverField of ['passenger_id', 'status', 'estimated_price']) {
    if (Object.prototype.hasOwnProperty.call(input, serverField)) {
      throw validationError(`${serverField} est géré par le serveur.`)
    }
  }

  const pickup = normalizeLocation(input.pickup, 'départ')
  const destination = normalizeLocation(input.destination, 'destination')
  const rideType = input.ride_type ?? input.rideType
  if (!RIDE_TYPES.includes(rideType)) {
    throw validationError('Le type de course est invalide.')
  }

  const scheduledAt = input.scheduled_at ?? input.scheduledAt ?? null
  if (scheduledAt !== null) {
    const parsed = new Date(scheduledAt)
    if (Number.isNaN(parsed.getTime())) throw validationError('La date planifiée est invalide.')
    return {
      pickup,
      destination,
      ride_type: rideType,
      scheduled_at: parsed.toISOString(),
    }
  }

  return {
    pickup,
    destination,
    ride_type: rideType,
    scheduled_at: scheduledAt,
  }
}

function fromDatabaseRow(row) {
  const value = Array.isArray(row) ? row[0] : row
  if (!value?.id) throw new Error('La course créée n’a pas été retournée par le backend.')

  return {
    id: value.id,
    passengerId: value.passenger_id,
    pickup: { label: value.pickup_label, lat: value.pickup_lat, lng: value.pickup_lng },
    destination: { label: value.destination_label, lat: value.destination_lat, lng: value.destination_lng },
    rideType: value.ride_type,
    scheduledAt: value.scheduled_at,
    status: value.status,
    estimatedPrice: value.estimated_price,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  }
}

export class SupabaseRideService {
  constructor({ client = null, clientFactory = null } = {}) {
    this.client = client
    this.clientFactory = clientFactory
  }

  async getClient() {
    if (this.client) return this.client
    if (!this.clientFactory) throw new Error('Client Supabase indisponible.')
    this.client = await this.clientFactory()
    return this.client
  }

  async createRide(input) {
    const payload = normalizeCreateInput(input)
    const client = await this.getClient()
    const { data, error } = await client.rpc('create_ride', {
      p_pickup: payload.pickup,
      p_destination: payload.destination,
      p_ride_type: payload.ride_type,
      p_scheduled_at: payload.scheduled_at,
    })
    if (error) throw error
    return fromDatabaseRow(data)
  }
}

export class DemoRideService {
  async createRide(input) {
    const payload = normalizeCreateInput(input)
    const now = new Date().toISOString()
    return {
      id: `demo-ride-${Date.now()}`,
      passengerId: 'demo-passenger',
      pickup: payload.pickup,
      destination: payload.destination,
      rideType: payload.ride_type,
      scheduledAt: payload.scheduled_at,
      status: 'requested',
      estimatedPrice: null,
      createdAt: now,
      updatedAt: now,
    }
  }
}

let service

export function getRideService() {
  if (service) return service
  if (isDemoMode) {
    service = new DemoRideService()
  } else if (runtimeConfig.valid) {
    service = new SupabaseRideService({ clientFactory: () => getAuthService().getClient() })
  } else {
    throw new Error(runtimeConfig.error)
  }
  return service
}

export function resetRideServiceForTests() {
  service = undefined
}
