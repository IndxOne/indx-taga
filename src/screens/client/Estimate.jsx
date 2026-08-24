import { useNavigate } from 'react-router-dom'
import { useAppStore, RIDE_OPTIONS } from '../../store/useAppStore'
import MapView from '../../components/MapView'
import RideOptionCard from '../../components/RideOptionCard'
import PrimaryButton from '../../components/PrimaryButton'
import BackButton from '../../components/BackButton'
import { ROUTES } from '../../navigation/routes'
import ClientRideMap from '../../components/ClientRideMap'

export default function Estimate() {
  const navigate = useNavigate()
  const ride = useAppStore((state) => state.ride)
  const selectedId = useAppStore((state) => state.selectedRideOptionId)
  const setSelectedId = useAppStore((state) => state.setSelectedRideOptionId)
  const setRideStatus = useAppStore((state) => state.setRideStatus)
  const paymentMethods = useAppStore((state) => state.paymentMethods)
  const selectedOption = RIDE_OPTIONS.find((option) => option.id === selectedId)
  const defaultPayment = paymentMethods.find((method) => method.isDefault) ?? paymentMethods[0]

  const handleOrder = () => {
    setRideStatus('searching')
    navigate('/client/active-ride')
  }

  return (
    <div className="relative flex-1 flex flex-col">
      <div className="relative">
        <MapView className="h-52 shrink-0" aria-label="Carte de l’itinéraire estimé">
          <ClientRideMap phase="estimate" />
        </MapView>
        <div className="absolute left-4 top-4 z-10">
          <BackButton to={ROUTES.clientHome} />
        </div>
      </div>

      <div className="flex-1 bg-white -mt-6 rounded-t-3xl px-5 py-6 flex flex-col gap-4 overflow-y-auto">
        <div>
          <p className="text-xs text-gray-400 uppercase">Choisis ta course</p>
          <p className="font-bold">{ride.distanceKm} km · ~{ride.durationMin} min</p>
          <p className="text-xs text-gray-400">{ride.pickupLabel} → {ride.dropoffLabel}</p>
        </div>

        <div className="flex flex-col gap-3">
          {RIDE_OPTIONS.map((option) => (
            <RideOptionCard
              key={option.id}
              {...option}
              selected={option.id === selectedId}
              onSelect={() => setSelectedId(option.id)}
            />
          ))}
        </div>

        {defaultPayment && (
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
          <PrimaryButton onClick={handleOrder} disabled={!selectedOption}>
            Commander · {new Intl.NumberFormat('fr-FR').format(selectedOption?.price ?? 0)} F CFA
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
