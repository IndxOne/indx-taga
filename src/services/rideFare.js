export const RIDE_FARES = Object.freeze({
  go: 3200,
  partage: 1900,
  family: 4500,
  confort: 4200,
})

export const DEFAULT_RIDE_FARE = RIDE_FARES.go
export const DRIVER_COMMISSION_RATE = 0.85

export function normalizeRideFare(value, rideType) {
  const amount = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : Number.NaN

  if (Number.isFinite(amount) && amount >= 0) return amount
  return RIDE_FARES[rideType] ?? DEFAULT_RIDE_FARE
}

export function getRidePricing(value, rideType) {
  const price = normalizeRideFare(value, rideType)
  return {
    estimatedPrice: price,
    price,
    driverEarning: Math.round(price * DRIVER_COMMISSION_RATE),
  }
}

// Mode réel : aucun tarif de repli. Tant que le backend n'a pas fixé le prix,
// le montant reste inconnu (null) au lieu d'afficher une valeur fictive.
export function getServerRidePricing(value) {
  const amount = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : Number.NaN

  if (!Number.isFinite(amount) || amount < 0) {
    return { estimatedPrice: null, price: null, driverEarning: null }
  }
  return {
    estimatedPrice: amount,
    price: amount,
    driverEarning: Math.round(amount * DRIVER_COMMISSION_RATE),
  }
}
