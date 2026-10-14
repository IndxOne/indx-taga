import { getAuthService } from './authService'
import { isDemoMode, runtimeConfig } from './runtimeConfig'
import { getServerRidePricing } from './rideFare'

const AVAILABILITY_STATUSES = Object.freeze(['offline', 'available', 'on_ride'])
export const DRIVER_RIDE_TRANSITIONS = Object.freeze(['arriving', 'arrived', 'in_progress', 'completed'])

function backendError(message, code = 'dispatch_error') {
  const error = new Error(message)
  error.code = code
  return error
}

function normalizeAvailability(row) {
  const value = Array.isArray(row) ? row[0] : row
  const availabilityStatus = value?.availability_status
  if (!AVAILABILITY_STATUSES.includes(availabilityStatus)) {
    throw backendError('La disponibilité retournée par le backend est invalide.', 'invalid_dispatch_response')
  }

  return {
    userId: value.user_id,
    availabilityStatus,
    available: availabilityStatus === 'available',
    availableSince: value.available_since || null,
    updatedAt: value.updated_at || null,
  }
}

function normalizeRide(row) {
  const value = Array.isArray(row) ? row[0] : row
  if (!value?.id) throw backendError('La course retournée par le backend est invalide.', 'invalid_dispatch_response')
  const pricing = getServerRidePricing(value.estimated_price)

  return {
    id: value.id,
    passengerId: value.passenger_id,
    pickup: { label: value.pickup_label, lat: value.pickup_lat, lng: value.pickup_lng },
    destination: { label: value.destination_label, lat: value.destination_lat, lng: value.destination_lng },
    pickupLabel: value.pickup_label,
    dropoffLabel: value.destination_label,
    rideType: value.ride_type,
    scheduledAt: value.scheduled_at,
    driverId: value.driver_id || null,
    status: value.status,
    ...pricing,
    assignedAt: value.assigned_at || null,
    dispatchDeadlineAt: value.dispatch_deadline_at || null,
    createdAt: value.created_at,
    updatedAt: value.updated_at || null,
  }
}

export class SupabaseDispatchService {
  constructor({ client = null, clientFactory = null } = {}) {
    this.client = client
    this.clientFactory = clientFactory
  }

  async getClient() {
    if (this.client) return this.client
    if (!this.clientFactory) throw backendError('Client Supabase indisponible.', 'missing_client')
    this.client = await this.clientFactory()
    return this.client
  }

  async setDriverAvailability(available) {
    if (typeof available !== 'boolean') {
      throw backendError('La disponibilité doit être un booléen.', 'invalid_dispatch_input')
    }
    const { data, error } = await (await this.getClient()).rpc('set_driver_availability', {
      p_available: available,
    })
    if (error) throw error
    return normalizeAvailability(data)
  }

  async requestRideDispatch(rideId) {
    if (typeof rideId !== 'string' || !rideId.trim()) {
      throw backendError('Un identifiant de course est requis.', 'invalid_dispatch_input')
    }
    const { data, error } = await (await this.getClient()).rpc('request_ride_dispatch', {
      p_ride_id: rideId,
    })
    if (error) throw error
    return normalizeRide(data)
  }

  async respondToOffer(offerId, decision) {
    if (typeof offerId !== 'string' || !offerId.trim()) {
      throw backendError('Un identifiant d’offre est requis.', 'invalid_dispatch_input')
    }
    if (!['accept', 'reject'].includes(decision)) {
      throw backendError('La décision doit être accept ou reject.', 'invalid_dispatch_input')
    }
    const { data, error } = await (await this.getClient()).rpc('respond_to_ride_offer', {
      p_offer_id: offerId,
      p_decision: decision,
    })
    if (error) throw error
    return normalizeRide(data)
  }

  // Le serveur valide le chauffeur, l'ordre des étapes et l'idempotence.
  async advanceRide(rideId, toStatus) {
    if (typeof rideId !== 'string' || !rideId.trim()) {
      throw backendError('Un identifiant de course est requis.', 'invalid_dispatch_input')
    }
    if (!DRIVER_RIDE_TRANSITIONS.includes(toStatus)) {
      throw backendError('Le statut demandé est invalide.', 'invalid_dispatch_input')
    }
    const { data, error } = await (await this.getClient()).rpc('advance_driver_ride', {
      p_ride_id: rideId,
      p_to_status: toStatus,
    })
    if (error) throw error
    return normalizeRide(data)
  }

  async expireOffer(offerId) {
    if (typeof offerId !== 'string' || !offerId.trim()) {
      throw backendError('Un identifiant d’offre est requis.', 'invalid_dispatch_input')
    }
    const { data, error } = await (await this.getClient()).rpc('expire_ride_dispatch_offer', {
      p_offer_id: offerId,
    })
    if (error) throw error
    return normalizeRide(data)
  }
}

export class DemoDispatchService {
  constructor({ initialAvailable = false } = {}) {
    this.available = initialAvailable
  }

  async setDriverAvailability(available) {
    this.available = available
    return {
      userId: 'demo-driver',
      availabilityStatus: available ? 'available' : 'offline',
      available,
      availableSince: available ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    }
  }

  async requestRideDispatch(rideId) {
    return { id: rideId, status: 'searching', driverId: null, dispatchDeadlineAt: null }
  }

  async respondToOffer(offerId, decision) {
    return { id: `demo-ride-for-${offerId}`, status: decision === 'accept' ? 'assigned' : 'searching' }
  }

  async advanceRide(rideId, toStatus) {
    return { id: rideId, status: toStatus }
  }

  async expireOffer(offerId) {
    return { id: `demo-ride-for-${offerId}`, status: 'searching' }
  }
}

let service

export function getDispatchService() {
  if (service) return service
  if (isDemoMode) {
    service = new DemoDispatchService()
  } else if (runtimeConfig.valid) {
    service = new SupabaseDispatchService({ clientFactory: () => getAuthService().getClient() })
  } else {
    throw new Error(runtimeConfig.error)
  }
  return service
}

export function resetDispatchServiceForTests() {
  service = undefined
}
