import { getAuthService } from './authService'
import { isDemoMode, runtimeConfig } from './runtimeConfig'

const ACTIVE_RIDE_STATUSES = new Set(['requested', 'searching', 'assigned', 'arriving', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_driver'])
const LOCATION_VISIBLE_STATUSES = new Set(['assigned', 'arriving', 'arrived', 'in_progress'])
export const DRIVER_LOCATION_MAX_AGE_MS = 60_000

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
    estimatedPrice: value.estimated_price,
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
      .select('id, passenger_id, driver_id, pickup_label, pickup_lat, pickup_lng, destination_label, destination_lat, destination_lng, ride_type, scheduled_at, status, estimated_price, assigned_at, dispatch_deadline_at, created_at, updated_at')
      .eq('id', rideId)
      .maybeSingle()
    if (error) throw error
    return data ? normalizeRide(data) : null
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
                onRideChange?.(ride)
                if (!LOCATION_VISIBLE_STATUSES.has(ride.status)) emitDriverLocation(null)
              } catch (error) {
                onError?.(error)
              }
            },
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'driver_locations', filter: `ride_id=eq.${rideId}` },
            (payload) => {
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
}

export class DemoRideRealtimeService {
  async getRide() {
    return null
  }

  async getDriverLocation() {
    return null
  }

  subscribeToRide() {
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

export { normalizeLocation as normalizeDriverLocation, normalizeRide as normalizeRealtimeRide }
