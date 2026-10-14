import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, RIDE_OPTIONS } from '../../store/useAppStore'
import MapProvider from '../../components/MapProvider'
import RideOptionCard from '../../components/RideOptionCard'
import PrimaryButton from '../../components/PrimaryButton'
import BackButton from '../../components/BackButton'
import { ROUTES } from '../../navigation/routes'
import ClientRideMap from '../../components/ClientRideMap'
import { getRideService } from '../../services/rideService'
import { getRidePricing } from '../../services/rideFare'
import { isTrustedRidePoint } from '../../services/ridePoints'
import { isDemoMode } from '../../services/runtimeConfig'

export const REAL_ORDER_BLOCKED_REASON = 'La commande de course réelle est désactivée : aucune sélection d’adresse fiable (départ et destination géolocalisés) n’est disponible dans cette version.'

export default function Estimate() {
  const navigate = useNavigate()
  const ride = useAppStore((state) => state.ride)
  const selectedId = useAppStore((state) => state.selectedRideOptionId)
  const setSelectedId = useAppStore((state) => state.setSelectedRideOptionId)
  const setRide = useAppStore((state) => state.setRide)
  const setRideStatus = useAppStore((state) => state.setRideStatus)
  const paymentMethods = useAppStore((state) => state.paymentMethods)
  const selectedOption = RIDE_OPTIONS.find((option) => option.id === selectedId)
  const defaultPayment = paymentMethods.find((method) => method.isDefault) ?? paymentMethods[0]
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Réel : commande possible uniquement avec deux points fiables (libellé, 2 coordonnées, provenance).
  const pointsReady = isDemoMode || (isTrustedRidePoint(ride.pickup) && isTrustedRidePoint(ride.destination))

  const handleOrder = async () => {
    if (!selectedOption || isSubmitting || !pointsReady) return
    setIsSubmitting(true)
    setError('')
    try {
      const createdRide = await getRideService().createRide(isDemoMode
        ? { pickup: { label: ride.pickupLabel }, destination: { label: ride.dropoffLabel }, ride_type: selectedOption.id }
        : { pickup: ride.pickup, destination: ride.destination, ride_type: selectedOption.id })
      // Réel : montants tels que renvoyés par le serveur (null si non fournis), sans calcul client.
      const pricing = isDemoMode ? getRidePricing(createdRide.estimatedPrice, selectedOption.id) : {
        estimatedPrice: createdRide.estimatedPrice,
        finalPrice: createdRide.finalPrice,
        driverEarning: createdRide.driverEarning,
        paymentStatus: createdRide.paymentStatus,
      }
      setRide({
        ...ride,
        id: createdRide.id,
        status: createdRide.status,
        ...pricing,
      })
      // Le mode démo conserve son scénario visuel. En mode réel, le statut
      // affiché provient de la réponse RPC et reste requested pour ce lot.
      setRideStatus(isDemoMode ? 'searching' : createdRide.status)
      navigate('/client/active-ride')
    } catch (orderError) {
      setError(orderError.message || 'La course n’a pas pu être créée.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative flex-1 flex flex-col">
      <div className="relative">
        <MapProvider className="h-52 shrink-0" aria-label="Carte de l’itinéraire estimé">
          <ClientRideMap phase="estimate" />
        </MapProvider>
        <div className="absolute left-4 top-4 z-10">
          <BackButton to={ROUTES.clientHome} />
        </div>
      </div>

      <div className="flex-1 bg-white -mt-6 rounded-t-3xl px-5 py-6 flex flex-col gap-4 overflow-y-auto">
        <div>
          <p className="text-xs text-gray-400 uppercase">Choisis ta course</p>
          {isDemoMode && <p className="font-bold">{ride.distanceKm} km · ~{ride.durationMin} min</p>}
          {isDemoMode && <p className="text-xs text-gray-400">{ride.pickupLabel} → {ride.dropoffLabel}</p>}
          {!isDemoMode && pointsReady && <p className="text-xs text-gray-400">{ride.pickup.label} → {ride.destination.label}</p>}
          {!isDemoMode && !pointsReady && (
            <p role="status" className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
              {REAL_ORDER_BLOCKED_REASON}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {RIDE_OPTIONS.map((option) => (
            <RideOptionCard
              key={option.id}
              {...option}
              showPrice={isDemoMode}
              selected={option.id === selectedId}
              onSelect={() => setSelectedId(option.id)}
            />
          ))}
        </div>

        {isDemoMode && defaultPayment && (
          <button
            type="button"
            onClick={() => navigate(ROUTES.paymentMethods)}
            className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2 text-left"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-[10px] font-bold text-white">OM</span>
            <span className="flex-1">
              <span className="block text-xs font-semibold text-gray-700">{defaultPayment.label}</span>
              <span className="block text-[10px] text-gray-400">{defaultPayment.maskedNumber}</span>
            </span>
            <span className="text-xs font-semibold text-taga-blue">Changer</span>
          </button>
        )}

        <div className="mt-auto pt-2">
          <PrimaryButton onClick={handleOrder} disabled={!selectedOption || isSubmitting || !pointsReady}>
            {isSubmitting ? 'Création en cours…' : isDemoMode ? `Commander · ${new Intl.NumberFormat('fr-FR').format(selectedOption?.price ?? 0)} F CFA` : 'Demander cette course'}
          </PrimaryButton>
        </div>
        {error && <p role="alert" className="text-center text-xs text-red-500">{error}</p>}
      </div>
    </div>
  )
}
