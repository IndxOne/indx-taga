// Erreurs de lecture d'une course : « interdit » (course d'un autre compte ou
// session absente) se distingue d'un incident réseau/serveur.
export function classifyRideReadError(error) {
  const code = String(error?.code ?? '')
  const status = Number(error?.status)
  if (['42501', '28000', 'forbidden', 'unauthenticated'].includes(code) || status === 401 || status === 403) {
    return 'forbidden'
  }
  return 'error'
}
