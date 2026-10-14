// Mémoire de session (onglet) du passager : quelle course suivre après un
// rechargement, et quelles courses terminées ont déjà été clôturées. Ce n'est
// qu'un pointeur d'identifiant : le statut et les montants viennent toujours du
// serveur. sessionStorage peut être indisponible : repli en mémoire.
const ACTIVE_KEY = 'taga.passenger.activeRideId'
const CLOSED_KEY = 'taga.passenger.closedRideIds'
const MAX_CLOSED = 20

let memoryActive = null
let memoryClosed = []

function store() {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

function read(key, fallback) {
  try {
    const raw = store()?.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    store()?.setItem(key, JSON.stringify(value))
  } catch {
    // Quota ou mode privé : le repli mémoire reste valable pour l'onglet courant.
  }
}

function validId(rideId) {
  return typeof rideId === 'string' && rideId.trim() !== ''
}

export function rememberRide(rideId) {
  if (!validId(rideId)) return
  memoryActive = rideId
  write(ACTIVE_KEY, rideId)
}

export function recallRide() {
  const stored = read(ACTIVE_KEY, null)
  return validId(stored) ? stored : memoryActive
}

export function forgetRide() {
  memoryActive = null
  try {
    store()?.removeItem(ACTIVE_KEY)
  } catch {
    // ignoré : voir write()
  }
}

export function isRideClosed(rideId) {
  const stored = read(CLOSED_KEY, [])
  return validId(rideId) && (memoryClosed.includes(rideId) || (Array.isArray(stored) && stored.includes(rideId)))
}

// Clôture explicite du récapitulatif : il ne doit plus jamais se rouvrir.
export function markRideClosed(rideId) {
  if (!validId(rideId)) return
  const stored = read(CLOSED_KEY, [])
  const closed = [...new Set([...(Array.isArray(stored) ? stored : []), ...memoryClosed, rideId])].slice(-MAX_CLOSED)
  memoryClosed = closed
  write(CLOSED_KEY, closed)
  if (recallRide() === rideId) forgetRide()
}

export function resetRideSessionForTests() {
  memoryActive = null
  memoryClosed = []
  try {
    store()?.removeItem(ACTIVE_KEY)
    store()?.removeItem(CLOSED_KEY)
  } catch {
    // ignoré
  }
}
