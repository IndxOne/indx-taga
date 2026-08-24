import { useNavigate } from 'react-router-dom'
import { useAppStore, RIDE_OPTIONS } from '../../store/useAppStore'
import MapView from '../../components/MapView'
import RideOptionCard from '../../components/RideOptionCard'
import PrimaryButton from '../../components/PrimaryButton'

export default function Estimate() {
  const navigate = useNavigate()
  const ride = useAppStore((state) => state.ride)
  const selectedId = useAppStore((state) => state.selectedRideOptionId)
  const setSelectedId = useAppStore((state) => state.setSelectedRideOptionId)
  const setRideStatus = useAppStore((state) => state.setRideStatus)
  const selectedOption = RIDE_OPTIONS.find((option) => option.id === selectedId)

  const handleOrder = () => {
    setRideStatus('searching')
    navigate('/client/active-ride')
  }

  return (
    <div className="flex-1 flex flex-col">
      <MapView className="h-48 shrink-0" />

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

        <div className="mt-auto pt-2">
          <PrimaryButton onClick={handleOrder} disabled={!selectedOption}>
            Commander · {new Intl.NumberFormat('fr-FR').format(selectedOption?.price ?? 0)} F CFA
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
