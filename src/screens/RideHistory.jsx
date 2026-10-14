import { useAppStore } from '../store/useAppStore'
import RideHistoryTile from '../components/RideHistoryTile'
import EmptyState from '../components/EmptyState'
import BottomNavBar from '../components/BottomNavBar'
import { isDemoMode } from '../services/runtimeConfig'

export default function RideHistory() {
  const role = useAppStore((state) => state.role)
  const rideHistory = useAppStore((state) => state.rideHistory)
  const mode = role === 'driver' ? 'driver' : 'passenger'

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-8 pb-4">
        <h1 className="text-xl font-bold">Historique des courses</h1>
      </div>

      {rideHistory.length === 0 ? (
        <EmptyState
          icon="receipt"
          title={isDemoMode ? "Aucune course pour l'instant" : "Historique indisponible"}
          subtitle={isDemoMode ? 'Vos trajets terminés apparaîtront ici.' : "L'historique des courses sera disponible dans une prochaine version."}
        />
      ) : (
        <div className="flex-1 px-6 overflow-y-auto">
          {rideHistory.map((ride) => (
            <RideHistoryTile key={ride.id} ride={ride} mode={mode} />
          ))}
        </div>
      )}

      <BottomNavBar />
    </div>
  )
}
