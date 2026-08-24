import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import MapView from '../../components/MapView'
import AmountTile from '../../components/AmountTile'
import ToggleSwitch from '../../components/ToggleSwitch'
import { DRIVER_NAV_ITEMS, ROUTES } from '../../navigation/routes'

export default function Online() {
  const navigate = useNavigate()
  const location = useLocation()
  const driverAvailable = useAppStore((state) => state.driverAvailable)
  const setDriverAvailable = useAppStore((state) => state.setDriverAvailable)
  const driverEarningsToday = useAppStore((state) => state.driverEarningsToday)
  const driverRidesToday = useAppStore((state) => state.driverRidesToday)
  const driverHoursOnline = useAppStore((state) => state.driverHoursOnline)

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden bg-gray-100">
      <div className="absolute inset-x-0 top-0 z-20 px-5 py-4 flex items-center justify-between bg-white/90 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-taga-mango text-white flex items-center justify-center font-bold">YA</div>
          <div>
            <p className="text-xs text-gray-400">BONJOUR, CHEF</p>
            <p className="font-bold text-sm">Yao Aristide</p>
          </div>
        </div>
        {driverAvailable && <span className="text-xs font-semibold text-taga-green flex items-center gap-1">● EN LIGNE</span>}
      </div>

      <MapView className="absolute inset-0" aria-label="Carte de disponibilité chauffeur">
        <div className="absolute inset-0 opacity-70">
          <div className="absolute left-[12%] top-[28%] h-2/3 w-10 bg-white/80" />
          <div className="absolute right-[16%] top-[18%] h-1/2 w-16 bg-white/80" />
          <div className="absolute left-0 right-0 top-[42%] h-8 bg-white/80" />
          <div className="absolute bottom-[28%] left-[28%] h-24 w-28 bg-gray-200/80" />
        </div>
        <div className="absolute left-1/2 top-[42%] flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
          <span className="absolute h-44 w-44 animate-pulse rounded-full bg-taga-green/20" />
          <span className="absolute h-28 w-28 rounded-full bg-taga-green/30" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-taga-green text-2xl text-white shadow-lg">🚗</span>
        </div>
      </MapView>

      <div className="absolute inset-x-0 bottom-0 z-10 max-h-[58%] overflow-y-auto rounded-t-3xl bg-taga-navy px-5 py-5 text-white shadow-[0_-8px_24px_rgba(10,17,40,0.18)] flex flex-col gap-4">
        <div>
          <p className="text-xs text-white/50">TES GAINS AUJOURD'HUI</p>
          <AmountTile amount={driverEarningsToday} size="xl" tone="light" />
        </div>
        <p className="text-xs text-white/60">Courses · {driverRidesToday} · En ligne · {driverHoursOnline}</p>

        <div className="flex items-center justify-between bg-white/10 rounded-xl px-4 py-3">
          <ToggleSwitch
            id="availability-toggle"
            checked={driverAvailable}
            onChange={setDriverAvailable}
            label="Disponible pour course"
          />
          {driverAvailable && (
            <button type="button" onClick={() => navigate(ROUTES.driverIncomingRequest)} className="text-taga-mango text-sm font-semibold">
              Simuler →
            </button>
          )}
        </div>

        <nav aria-label="Navigation chauffeur" className="grid grid-cols-4 border-t border-white/15 pt-3">
          {DRIVER_NAV_ITEMS.map((item) => {
            const active = location.pathname === item.path
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(item.path)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 text-xs transition-opacity ${
                  active ? 'text-white' : 'text-white/45'
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
