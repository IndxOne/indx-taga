import MapView from './MapView'
import { resolveMapProvider } from './mapProvider'

export default function MapProvider({ children, className = '', provider, 'aria-label': ariaLabel = 'Carte de la zone de trajet' }) {
  const resolved = resolveMapProvider(provider)

  return (
    <MapView
      className={className}
      aria-label={ariaLabel}
      data-map-provider={resolved.provider}
      data-map-requested-provider={resolved.requested}
      data-map-fallback={resolved.fallback ? 'true' : 'false'}
    >
      {children}
    </MapView>
  )
}
