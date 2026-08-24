import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import MapView from '../../components/MapView'
import AmountTile from '../../components/AmountTile'

export default function Online() {
  const navigate = useNavigate()
  const driverAvailable = useAppStore((state) => state.driverAvailable)
  const setDriverAvailable = useAppStore((state) => state.setDriverAvailable)
  const driverEarningsToday = useAppStore((state) => state.driverEarningsToday)
  const driverRidesToday = useAppStore((state) => state.driverRidesToday)
  const driverHoursOnline = useAppStore((state) => state.driverHoursOnline)

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-taga-mango text-white flex items-center justify-center font-bold">YA</div>
          <div>
            <p className="text-xs text-gray-400">BONJOUR, CHEF</p>
            <p className="font-bold text-sm">Yao Aristide</p>
          </div>
        </div>
        {driverAvailable && <span className="text-xs font-semibold text-taga-green flex items-center gap-1">● EN LIGNE</span>}
      </div>

      <MapView className="flex-1" />

      <div className="bg-taga-navy text-white rounded-t-3xl -mt-6 px-5 py-5 flex flex-col gap-4">
        <div>
          <p className="text-xs text-white/50">TES GAINS AUJOURD'HUI</p>
          <AmountTile amount={driverEarningsToday} size="xl" tone="light" />
        </div>
        <p className="text-xs text-white/60">Courses · {driverRidesToday} · En ligne · {driverHoursOnline}</p>

        <div className="flex items-center justify-between bg-white/10 rounded-xl px-4 py-3">
          <label className="flex items-center gap-3 text-sm font-medium" htmlFor="availability-toggle">
            <input
              id="availability-toggle"
              type="checkbox"
              checked={driverAvailable}
              onChange={(event) => setDriverAvailable(event.target.checked)}
              className="w-5 h-5 accent-taga-green"
            />
            Disponible pour course
          </label>
          {driverAvailable && (
            <button type="button" onClick={() => navigate('/driver/incoming-request')} className="text-taga-mango text-sm font-semibold">
              Simuler →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
