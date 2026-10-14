import { getAuthService } from './authService'
import { isDemoMode, runtimeConfig } from './runtimeConfig'
import { getServerRidePricing } from './rideFare'

const ACTIVE_RIDE_STATUSES = new Set(['requested', 'searching', 'assigned', 'arriving', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_driver'])
const RESTORABLE_RIDE_STATUSES = Object.freeze(['requested', 'searching', 'assigned', 'arriving', 'arrived', 'in_progress', 'no_driver'])
const DRIVER_ACTIVE_RIDE_STATUSES = Object.freeze(['assigned', 'arriving', 'arrived', 'in_progress'])
const LOCATION_VISIBLE_STATUSES = new Set(['assigned', 'arriving', 'arrived', 'in_progress'])
export const DRIVER_LOCATION_MAX_AGE_MS = 60_000
const RIDE_COLUMNS = 'id, passenger_id, driver_id, pickup_label, pickup_lat, pickup_lng, destination_label, destination_lat, destination_lng, ride_type, scheduled_at, status, estimated_price, assigned_at, dispatch_deadline_at, created_at, updated_at'

function realtimeError(message, code = 'realtime_error') {
  const error = new Error(message)
  error.code = code
  return error
}

function assertRideId(rideId) {
  if (typeof rideId !== 'string' || !rideId.trim() || /[\r\n,]/.test(rideId)) {
    throw realtimeError('Un identifiant de course valide est requis.', 'invalid_realtime_input')
  }
}

function normalizeRide(row) {
  const value = Array.isArray(row) ? row[0] : row
  if (!value?.id || !ACTIVE_RIDE_STATUSES.has(value.status)) {
    throw realtimeError('La course reçue en temps réel est invalide.', 'invalid_realtime_response')
  }
  const pricing = getServerRidePricing(value.estimated_price)
  return {
    id: value.id,
    passengerId: value.passenger_id,
    driverId: value.driver_id || null,
    pickup: { label: value.pickup_label, lat: value.pickup_lat, lng: value.pickup_lng },
    destination: { label: value.destination_label, lat: value.destination_lat, lng: value.destination_lng },
    pickupLabel: value.pickup_label,
    dropoffLabel: value.destination_label,
    rideType: value.ride_type,
    scheduledAt: value.scheduled_at,
    status: value.status,
    ...pricing,
    assignedAt: value.assigned_at || null,
    dispatchDeadlineAt: value.dispatch_deadline_at || null,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  }
}

function normalizeLocation(row) {
  const value = Array.isArray(row) ? row[0] : row
  if (!value?.ride_id || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)) {
    throw realtimeError('La position chauffeur reçue en temps réel est invalide.', 'invalid_realtime_response')
  }
  return {
    rideId: value.ride_id,
    driverId: value.driver_id,
    lat: value.latitude,
    lng: value.longitude,
    accuracyM: Number.isFinite(value.accuracy_m) ? value.accuracy_m : null,
    headingDeg: Number.isFinite(value.heading_deg) ? value.heading_deg : null,
    speedMps: Number.isFinite(value.speed_mps) ? value.speed_mps : null,
    recordedAt: value.recorded_at || null,
    updatedAt: value.updated_at || null,
  }
}

function normalizeOffer(response) {
  const offer = response?.offer
  const ride = response?.ride
  if (!offer?.id || !offer.ride_id || !ride?.id || ride.id !== offer.ride_id || offer.status !== 'offered') {
    throw realtimeError('L’offre chauffeur reçue par le backend est invalide.', 'invalid_realtime_response')
  }

  return {
    id: offer.id,
    rideId: offer.ride_id,
    driverId: offer.driver_id,
    status: offer.status,
    offeredAt: offer.offered_at,
    expiresAt: offer.expires_at,
    respondedAt: offer.responded_at || null,
    createdAt: offer.created_at,
    ride: normalizeRide(ride),
  }
}

export function isFreshDriverLocation(location, { now = Date.now(), maxAgeMs = DRIVER_LOCATION_MAX_AGE_MS } = {}) {
  if (!location?.recordedAt || !Number.isFinite(maxAgeMs) || maxAgeMs < 0) return false
  const recordedAt = Date.parse(location.recordedAt)
  if (!Number.isFinite(recordedAt)) return false
  return recordedAt <= now && now - recordedAt <= maxAgeMs
}

export function getDriverLocationRemainingMs(location, { now = Date.now(), maxAgeMs = DRIVER_LOCATION_MAX_AGE_MS } = {}) {
  if (!isFreshDriverLocation(location, { now, maxAgeMs })) return 0
  return Math.max(0, maxAgeMs - (now - Date.parse(location.recordedAt)))
}

export class SupabaseRideRealtimeService {
  constructor({ client = null, clientFactory = null } = {}) {
    this.client = client
    this.clientFactory = clientFactory
  }

  async getClient() {
    if (this.client) return this.client
    if (!this.clientFactory) throw realtimeError('Client Supabase indisponible.', 'missing_client')
    this.client = await this.clientFactory()
    return this.client
  }

  async getRide(rideId) {
    assertRideId(rideId)
    const { data, error } = await (await this.getClient())
      .from('rides')
      .select(RIDE_COLUMNS)
      .eq('id', rideId)
      .maybeSingle()
    if (error) throw error
    return data ? normalizeRide(data) : null
  }

  // Lecture ciblée d'une course TERMINÉE du passager authentifié. Distincte de
  // getActiveRide (statuts en cours). La RLS (rides_select_own) filtre déjà ; le
  // contrôle passenger_id est une seconde barrière explicite côté client.
  async getCompletedRide(rideId) {
    assertRideId(rideId)
    const client = await this.getClient()
    const { data: sessionData, error: sessionError } = await client.auth.getSession()
    const userId = sessionData?.session?.user?.id
    if (sessionError || !userId) {
      throw realtimeError('Une session est nécessaire pour lire cette course.', 'unauthenticated')
    }

    const { data, error } = await client
      .from('rides')
      .select(RIDE_COLUMNS)
      .eq('id', rideId)
      .eq('status', 'completed')
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    if (data.passenger_id !== userId) {
      throw realtimeError('Cette course n’appartient pas au compte connecté.', 'forbidden')
    }
    return normalizeRide(data)
  }

  async getActiveRide() {
    const { data, error } = await (await this.getClient())
      .from('rides')
      .select(RIDE_COLUMNS)
      .in('status', RESTORABLE_RIDE_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data ? normalizeRide(data) : null
  }

  // Restaure la course du chauffeur après rechargement. La RLS
  // rides_select_assigned_driver limite le résultat à ses propres courses.
  async getActiveDriverRide() {
    const { data, error } = await (await this.getClient())
      .from('rides')
      .select(RIDE_COLUMNS)
      .not('driver_id', 'is', null)
      .in('status', DRIVER_ACTIVE_RIDE_STATUSES)
      .order('assigned_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data ? normalizeRide(data) : null
  }

  async getActiveDriverOffer() {
    const { data, error } = await (await this.getClient()).rpc('get_driver_active_offer')
    if (error) throw error
    return data ? normalizeOffer(data) : null
  }

  async getDriverLocation(rideId, { now = Date.now(), maxAgeMs = DRIVER_LOCATION_MAX_AGE_MS } = {}) {
    assertRideId(rideId)
    const cutoff = new Date(now - maxAgeMs).toISOString()
    const { data, error } = await (await this.getClient())
      .from('driver_locations')
      .select('ride_id, driver_id, latitude, longitude, accuracy_m, heading_deg, speed_mps, recorded_at, updated_at')
      .eq('ride_id', rideId)
      .gte('recorded_at', cutoff)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    const location = normalizeLocation(data)
    return isFreshDriverLocation(location, { now, maxAgeMs }) ? location : null
  }

  subscribeToRide(rideId, { onRideChange, onDriverLocationChange, onError, now = Date.now, maxAgeMs = DRIVER_LOCATION_MAX_AGE_MS } = {}) {
    assertRideId(rideId)
    let channel
    let active = true
    let locationVisible = true
    let locationExpiryTimer

    const clearLocationExpiry = () => {
      if (locationExpiryTimer) clearTimeout(locationExpiryTimer)
      locationExpiryTimer = undefined
    }

    const emitDriverLocation = (location) => {
      clearLocationExpiry()
      onDriverLocationChange?.(location)
      if (!location) return
      const remainingMs = getDriverLocationRemainingMs(location, { now: now(), maxAgeMs })
      locationExpiryTimer = setTimeout(() => {
        locationExpiryTimer = undefined
        if (active) onDriverLocationChange?.(null)
      }, remainingMs + 1)
    }

    const subscribe = async () => {
      try {
        const client = await this.getClient()
        if (!active) return
        channel = client
          .channel(`taga:ride:${rideId}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${rideId}` },
            (payload) => {
              try {
                const ride = normalizeRide(payload.new)
                locationVisible = LOCATION_VISIBLE_STATUSES.has(ride.status)
                onRideChange?.(ride)
                if (!locationVisible) emitDriverLocation(null)
              } catch (error) {
                onError?.(error)
              }
            },
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'driver_locations', filter: `ride_id=eq.${rideId}` },
            (payload) => {
              if (!locationVisible) return
              if (payload.eventType === 'DELETE') {
                emitDriverLocation(null)
                return
              }
              try {
                const location = normalizeLocation(payload.new)
                emitDriverLocation(isFreshDriverLocation(location, { now: now(), maxAgeMs }) ? location : null)
              } catch (error) {
                onError?.(error)
              }
            },
          )
          .subscribe((status, error) => {
            if (!active) return
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || error) {
              onError?.(error || realtimeError('La synchronisation temps réel est indisponible.', 'realtime_channel_error'))
            }
          })
      } catch (error) {
        if (active) onError?.(error)
      }
    }

    void subscribe()
    return () => {
      active = false
      clearLocationExpiry()
      if (channel) void channel.unsubscribe()
    }
  }

  subscribeToDriverOffers({ onOfferChange, onError } = {}) {
    let channel
    let active = true

    const refreshOffer = async () => {
      try {
        const offer = await this.getActiveDriverOffer()
        if (active) onOfferChange?.(offer)
      } catch (error) {
        if (active) onError?.(error)
      }
    }

    const subscribe = async () => {
      try {
        const client = await this.getClient()
        if (!active) return
        channel = client
          .channel('taga:driver:offers')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'ride_dispatch_offers' },
            () => { void refreshOffer() },
          )
          .subscribe((status, error) => {
            if (!active) return
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || error) {
              onError?.(error || realtimeError('La réception des offres chauffeur est indisponible.', 'realtime_channel_error'))
            }
          })
      } catch (error) {
        if (active) onError?.(error)
      }
    }

    void subscribe()
    return () => {
      active = false
      if (channel) void channel.unsubscribe()
    }
  }
}

export class DemoRideRealtimeService {
  async getRide() {
    return null
  }

  async getActiveRide() {
    return null
  }

  async getCompletedRide() {
    return null
  }

  async getActiveDriverRide() {
    return null
  }

  async getActiveDriverOffer() {
    return null
  }

  async getDriverLocation() {
    return null
  }

  subscribeToRide() {
    return () => {}
  }

  subscribeToDriverOffers() {
    return () => {}
  }
}

let service

export function getRideRealtimeService() {
  if (service) return service
  if (isDemoMode) {
    service = new DemoRideRealtimeService()
  } else if (runtimeConfig.valid) {
    service = new SupabaseRideRealtimeService({ clientFactory: () => getAuthService().getClient() })
  } else {
    throw new Error(runtimeConfig.error)
  }
  return service
}

export function resetRideRealtimeServiceForTests() {
  service = undefined
}

export { normalizeLocation as normalizeDriverLocation, normalizeOffer as normalizeDriverOffer, normalizeRide as normalizeRealtimeRide }
