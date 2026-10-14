import { getAuthService } from './authService'
import { isDemoMode, runtimeConfig } from './runtimeConfig'
import { getRidePricing, getServerRideMoney } from './rideFare'
import { describeRidePointProblem, toRpcPoint } from './ridePoints'

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

// Mode réel : départ et destination doivent être des points fiables complets.
function normalizeTrustedLocation(value, fieldName) {
  const problem = describeRidePointProblem(value)
  if (problem) throw validationError(`Le point ${fieldName} est inutilisable : ${problem}.`)
  return toRpcPoint(value)
}

function normalizeCreateInput(input = {}, { trusted = false } = {}) {
  for (const serverField of ['passenger_id', 'status', 'estimated_price']) {
    if (Object.prototype.hasOwnProperty.call(input, serverField)) {
      throw validationError(`${serverField} est géré par le serveur.`)
    }
  }

  const normalize = trusted ? normalizeTrustedLocation : normalizeLocation
  const pickup = normalize(input.pickup, 'départ')
  const destination = normalize(input.destination, 'destination')
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

// Migration 012 : EXECUTE sur create_ride est révoqué aux clients tant que la
// sélection d'adresse fiable n'existe pas. PostgREST répond alors 42501 /
// « permission denied for function create_ride ».
function isRideCreationDisabled(error) {
  return error?.code === '42501' && /permission denied for function create_ride/i.test(String(error.message ?? ''))
}

function rideCreationDisabledError() {
  const error = new Error('La création de course réelle est désactivée : la sélection d’adresse fiable n’est pas encore disponible.')
  error.code = 'ride_creation_disabled'
  return error
}

function fromDatabaseRow(row) {
  const value = Array.isArray(row) ? row[0] : row
  if (!value?.id) throw new Error('La course créée n’a pas été retournée par le backend.')
  const money = getServerRideMoney(value.estimated_price)

  return {
    id: value.id,
    passengerId: value.passenger_id,
    pickup: { label: value.pickup_label, lat: value.pickup_lat, lng: value.pickup_lng },
    destination: { label: value.destination_label, lat: value.destination_lat, lng: value.destination_lng },
    rideType: value.ride_type,
    scheduledAt: value.scheduled_at,
    status: value.status,
    ...money,
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
    const payload = normalizeCreateInput(input, { trusted: true })
    const client = await this.getClient()
    const { data, error } = await client.rpc('create_ride', {
      p_pickup: payload.pickup,
      p_destination: payload.destination,
      p_ride_type: payload.ride_type,
      p_scheduled_at: payload.scheduled_at,
    })
    if (error) throw isRideCreationDisabled(error) ? rideCreationDisabledError() : error
    return fromDatabaseRow(data)
  }

  async cancelRideSearch(rideId) {
    if (typeof rideId !== 'string' || !rideId.trim()) {
      throw validationError('Un identifiant de course est requis.')
    }
    const { data, error } = await (await this.getClient()).rpc('cancel_ride_search', {
      p_ride_id: rideId,
    })
    if (error) throw error
    return fromDatabaseRow(data)
  }

  async retryRideSearch(rideId) {
    if (typeof rideId !== 'string' || !rideId.trim()) {
      throw validationError('Un identifiant de course est requis.')
    }
    const { data, error } = await (await this.getClient()).rpc('retry_ride_search', {
      p_ride_id: rideId,
    })
    if (error) throw error
    return fromDatabaseRow(data)
  }
}

export class DemoRideService {
  async createRide(input) {
    const payload = normalizeCreateInput(input)
    const now = new Date().toISOString()
    const pricing = getRidePricing(null, payload.ride_type)
    return {
      id: `demo-ride-${Date.now()}`,
      passengerId: 'demo-passenger',
      pickup: payload.pickup,
      destination: payload.destination,
      rideType: payload.ride_type,
      scheduledAt: payload.scheduled_at,
      status: 'requested',
      ...pricing,
      createdAt: now,
      updatedAt: now,
    }
  }

  async cancelRideSearch(rideId) {
    if (typeof rideId !== 'string' || !rideId.trim()) throw validationError('Un identifiant de course est requis.')
    return { id: rideId, status: 'cancelled', estimatedPrice: null }
  }

  async retryRideSearch(rideId) {
    if (typeof rideId !== 'string' || !rideId.trim()) throw validationError('Un identifiant de course est requis.')
    return { id: rideId, status: 'requested', estimatedPrice: null }
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
