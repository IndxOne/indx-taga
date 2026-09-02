const DEFAULT_OPTIONS = Object.freeze({
  enableHighAccuracy: true,
  maximumAge: 5_000,
  timeout: 10_000,
})

function geolocationError(message, code = 'geolocation_error') {
  const error = new Error(message)
  error.code = code
  return error
}

function getBrowserGeolocation() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw geolocationError('La géolocalisation n’est pas disponible sur cet appareil.', 'geolocation_unavailable')
  }
  return navigator.geolocation
}

function optionalNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function normalizeBrowserPosition(position) {
  const coordinates = position?.coords
  const latitude = optionalNumber(coordinates?.latitude)
  const longitude = optionalNumber(coordinates?.longitude)

  if (
    latitude === null
    || longitude === null
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180
  ) {
    throw geolocationError('La position GPS reçue est invalide.', 'geolocation_invalid_position')
  }

  return {
    lat: latitude,
    lng: longitude,
    accuracyM: optionalNumber(coordinates.accuracy),
    headingDeg: optionalNumber(coordinates.heading),
    speedMps: optionalNumber(coordinates.speed),
    timestamp: Number.isFinite(position.timestamp) ? position.timestamp : Date.now(),
  }
}

export function normalizeGeolocationError(error) {
  const codeMap = {
    1: ['geolocation_permission_denied', 'L’accès à la position a été refusé.'],
    2: ['geolocation_position_unavailable', 'La position est momentanément indisponible.'],
    3: ['geolocation_timeout', 'La recherche de position a expiré.'],
  }
  const [code, fallbackMessage] = codeMap[error?.code] || ['geolocation_error', 'La position n’a pas pu être obtenue.']
  const normalized = geolocationError(error?.message || fallbackMessage, code)
  normalized.cause = error
  return normalized
}

export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const geolocation = getBrowserGeolocation()
      geolocation.getCurrentPosition(
        (position) => {
          try {
            resolve(normalizeBrowserPosition(position))
          } catch (error) {
            reject(error)
          }
        },
        (error) => reject(normalizeGeolocationError(error)),
        { ...DEFAULT_OPTIONS, ...options },
      )
    } catch (error) {
      reject(error.code ? error : geolocationError('La géolocalisation n’a pas pu démarrer.'))
    }
  })
}

export function watchPosition(onSuccess, onError, options = {}) {
  let geolocation
  try {
    geolocation = getBrowserGeolocation()
  } catch (error) {
    onError?.(error)
    return () => {}
  }

  let watchId
  try {
    watchId = geolocation.watchPosition(
      (position) => {
        try {
          onSuccess?.(normalizeBrowserPosition(position))
        } catch (error) {
          onError?.(error)
        }
      },
      (error) => onError?.(normalizeGeolocationError(error)),
      { ...DEFAULT_OPTIONS, ...options },
    )
  } catch (error) {
    onError?.(error.code ? error : geolocationError('Le suivi GPS n’a pas pu démarrer.'))
    return () => {}
  }

  return () => geolocation.clearWatch(watchId)
}

export const browserGeolocation = Object.freeze({
  getCurrentPosition,
  watchPosition,
})
