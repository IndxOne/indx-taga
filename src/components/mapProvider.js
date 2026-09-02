const SUPPORTED_PROVIDERS = new Set(['svg'])

export function resolveMapProvider(provider = import.meta.env.VITE_MAP_PROVIDER) {
  const requested = String(provider || 'svg').trim().toLowerCase()
  return {
    requested: requested || 'svg',
    provider: SUPPORTED_PROVIDERS.has(requested) ? requested : 'svg',
    fallback: !SUPPORTED_PROVIDERS.has(requested),
  }
}
