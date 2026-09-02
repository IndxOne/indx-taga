import { getAuthService } from './authService'
import { browserGeolocation } from './geolocationService'
import { isDemoMode, runtimeConfig } from './runtimeConfig'

const DEFAULT_MIN_PUBLISH_INTERVAL_MS = 3_000

function locationError(message, code = 'location_error') {
  const error = new Error(message)
  error.code = code
  return error
}

function validateLocation(rideId, location) {
  if (typeof rideId !== 'string' || !rideId.trim()) {
    throw locationError('Un identifiant de course est requis.', 'invalid_location_input')
  }
  if (
    !location
    || typeof location.lat !== 'number'
    || !Number.isFinite(location.lat)
    || location.lat < -90
    || location.lat > 90
    || typeof location.lng !== 'number'
    || !Number.isFinite(location.lng)
    || location.lng < -180
    || location.lng > 180
  ) {
    throw locationError('Les coordonnées GPS sont invalides.', 'invalid_location_input')
  }
}

function optionalNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export class SupabaseDriverLocationService {
  constructor({ client = null, clientFactory = null, geolocation = browserGeolocation, minPublishIntervalMs = DEFAULT_MIN_PUBLISH_INTERVAL_MS, now = () => Date.now(), setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout } = {}) {
    this.client = client
    this.clientFactory = clientFactory
    this.geolocation = geolocation
    this.minPublishIntervalMs = minPublishIntervalMs
    this.now = now
    this.setTimeoutFn = setTimeoutFn
    this.clearTimeoutFn = clearTimeoutFn
  }

  async getClient() {
    if (this.client) return this.client
    if (!this.clientFactory) throw locationError('Client Supabase indisponible.', 'missing_client')
    this.client = await this.clientFactory()
    return this.client
  }

  async publishDriverLocation(rideId, location) {
    validateLocation(rideId, location)
    const { data, error } = await (await this.getClient()).rpc('publish_driver_location', {
      p_ride_id: rideId,
      p_latitude: location.lat,
      p_longitude: location.lng,
      p_accuracy_m: optionalNumber(location.accuracyM),
      p_heading_deg: optionalNumber(location.headingDeg),
      p_speed_mps: optionalNumber(location.speedMps),
    })
    if (error) throw error
    return data
  }

  watchAndPublish({ rideId, onLocation, onPublished, onError, options = {} } = {}) {
    validateLocation(rideId, { lat: 0, lng: 0 })
    let stopped = false
    let inFlight = null
    let pending = null
    let timer = null
    let lastPublishedAt = -Infinity

    const reportError = (error) => {
      if (!stopped) onError?.(error)
    }

    const flush = async () => {
      if (stopped || inFlight || !pending) return
      const nextLocation = pending
      pending = null
      const elapsed = this.now() - lastPublishedAt
      const wait = Math.max(0, this.minPublishIntervalMs - elapsed)
      if (wait > 0) {
        pending = nextLocation
        if (timer) return
        timer = this.setTimeoutFn(() => {
          timer = null
          void flush()
        }, wait)
        return
      }

      lastPublishedAt = this.now()
      inFlight = this.publishDriverLocation(rideId, nextLocation)
        .then((result) => onPublished?.(result))
        .catch(reportError)
        .finally(() => {
          inFlight = null
          if (!stopped && pending) void flush()
        })
      await inFlight
    }

    const stopWatching = this.geolocation.watchPosition(
      (location) => {
        if (stopped) return
        onLocation?.(location)
        pending = location
        void flush()
      },
      reportError,
      options,
    )

    return () => {
      stopped = true
      pending = null
      if (timer) this.clearTimeoutFn(timer)
      stopWatching?.()
    }
  }
}

export class DemoDriverLocationService {
  async publishDriverLocation(rideId, location) {
    validateLocation(rideId, location)
    return { rideId, ...location, simulated: true }
  }

  watchAndPublish() {
    return () => {}
  }
}

let service

export function getDriverLocationService() {
  if (service) return service
  if (isDemoMode) {
    service = new DemoDriverLocationService()
  } else if (runtimeConfig.valid) {
    service = new SupabaseDriverLocationService({ clientFactory: () => getAuthService().getClient() })
  } else {
    throw new Error(runtimeConfig.error)
  }
  return service
}

export function resetDriverLocationServiceForTests() {
  service = undefined
}
