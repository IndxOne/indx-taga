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

// Mode réel : aucun tarif de repli et aucun gain déduit côté frontend. Le prix
// vient du serveur (null tant qu'il n'est pas fixé). Le gain chauffeur reste
// null : aucun montant autoritatif n'est fourni par le backend, et la
// commission n'est une règle ni du frontend ni de ce lot.
export function getServerRidePricing(value) {
  const amount = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : Number.NaN

  if (!Number.isFinite(amount) || amount < 0) {
    return { estimatedPrice: null, price: null, driverEarning: null }
  }
  return { estimatedPrice: amount, price: amount, driverEarning: null }
}
