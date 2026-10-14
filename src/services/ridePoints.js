// Contrat des points de course en mode réel : un point n'est utilisable que s'il
// porte un libellé, deux coordonnées valides ET une provenance explicitement
// fiable. Aucune valeur par défaut, aucun libellé de démonstration.
//
// Provenances reconnues :
// - device_gps        : position fournie par l'appareil (géolocalisation navigateur)
// - address_selection : adresse choisie par l'utilisateur dans un sélecteur
//                       d'adresses fiable (non implémenté dans cette version)
// La provenance est une garantie CLIENT : le backend ne peut pas la vérifier.
export const TRUSTED_POINT_SOURCES = Object.freeze(['device_gps', 'address_selection'])

const MAX_LABEL_LENGTH = 240

export function describeRidePointProblem(point) {
  if (!point || typeof point !== 'object') return 'point manquant'
  if (typeof point.label !== 'string' || !point.label.trim()) return 'libellé manquant'
  if (point.label.trim().length > MAX_LABEL_LENGTH) return 'libellé trop long'
  if (typeof point.lat !== 'number' || !Number.isFinite(point.lat) || point.lat < -90 || point.lat > 90) {
    return 'latitude invalide'
  }
  if (typeof point.lng !== 'number' || !Number.isFinite(point.lng) || point.lng < -180 || point.lng > 180) {
    return 'longitude invalide'
  }
  if (point.lat === 0 && point.lng === 0) return 'coordonnées nulles'
  if (!TRUSTED_POINT_SOURCES.includes(point.source)) return 'provenance non fiable'
  return null
}

export function isTrustedRidePoint(point) {
  return describeRidePointProblem(point) === null
}

// Forme envoyée à la RPC : jamais la provenance, seulement libellé + coordonnées.
export function toRpcPoint(point) {
  return { label: point.label.trim(), lat: point.lat, lng: point.lng }
}
