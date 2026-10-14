// Numéro de test : réservé au mode démo en développement local.
export const DEV_TEST_PASSENGER_PHONE = '+330775679067'

export function usesTestPassengerPhone({ demo, dev, role }) {
  return Boolean(demo && dev && role === 'passenger')
}

const CI_CODE = '225'
const CI_NATIONAL_DIGITS = 10 // plan de numérotation ivoirien à 10 chiffres (0 initial conservé)
const E164_MIN_DIGITS = 8
const E164_MAX_DIGITS = 15

// Contrat strict : renvoie un numéro E.164 ou '' si l'entrée est invalide.
// - Côte d'Ivoire : +225 suivi des 10 chiffres nationaux, zéro initial inclus.
//   « 07 07 12 34 56 », « +225 07 07 12 34 56 » et « 00225… » donnent le même résultat.
// - Autres indicatifs (ex. numéro de test démo) : E.164 générique, 8 à 15 chiffres.
export function normalizePhone(value) {
  const input = String(value ?? '').trim()
  if (!/^\+?[\d\s.()-]+$/.test(input)) return ''

  let digits = input.replace(/\D/g, '')
  let international = input.startsWith('+')
  if (!international && digits.startsWith('00')) {
    digits = digits.slice(2)
    international = true
  }

  if (international || (digits.startsWith(CI_CODE) && digits.length === CI_CODE.length + CI_NATIONAL_DIGITS)) {
    if (digits.startsWith(CI_CODE)) {
      return digits.length === CI_CODE.length + CI_NATIONAL_DIGITS ? `+${digits}` : ''
    }
    return digits.length >= E164_MIN_DIGITS && digits.length <= E164_MAX_DIGITS ? `+${digits}` : ''
  }

  return digits.length === CI_NATIONAL_DIGITS ? `+${CI_CODE}${digits}` : ''
}

export function maskPhone(value) {
  const normalized = normalizePhone(value)
  if (normalized.length < 7) return normalized
  return `${normalized.slice(0, 4)} ${'•'.repeat(Math.max(2, normalized.length - 7))} ${normalized.slice(-3)}`
}
