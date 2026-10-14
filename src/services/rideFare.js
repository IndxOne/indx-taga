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

// Mode réel : contrat monétaire explicite, aucun champ fabriqué.
// - estimatedPrice : estimation indicative fournie par le serveur (rides.estimated_price),
//                    null tant qu'il n'en fournit pas. Ce n'est PAS un tarif final.
// - finalPrice     : montant final ; null tant qu'aucun backend métier autoritatif n'en fournit
//                    un (aucune colonne n'existe). Jamais copié depuis estimatedPrice.
// - driverEarning  : gain chauffeur autoritatif ; null (la commission n'est pas une règle frontend).
// - paymentStatus  : statut de paiement ; null tant qu'aucune transaction confirmée n'existe côté serveur.
export function getServerRideMoney(estimatedPrice) {
  const amount = typeof estimatedPrice === 'number'
    ? estimatedPrice
    : typeof estimatedPrice === 'string' && estimatedPrice.trim() !== ''
      ? Number(estimatedPrice)
      : Number.NaN

  return {
    estimatedPrice: Number.isFinite(amount) && amount >= 0 ? amount : null,
    finalPrice: null,
    driverEarning: null,
    paymentStatus: null,
  }
}
