import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import MapView from '../../components/MapView'
import AmountTile from '../../components/AmountTile'
import ToggleSwitch from '../../components/ToggleSwitch'
import { DRIVER_NAV_ITEMS, ROUTES } from '../../navigation/routes'
import Icon from '../../components/Icon'
import { getDispatchService } from '../../services/dispatchService'
import { isDemoMode } from '../../services/runtimeConfig'

export default function Online() {
  const navigate = useNavigate()
  const location = useLocation()
  const driverAvailable = useAppStore((state) => state.driverAvailable)
  const setDriverAvailable = useAppStore((state) => state.setDriverAvailable)
  const driverEarningsToday = useAppStore((state) => state.driverEarningsToday)
  const driverRidesToday = useAppStore((state) => state.driverRidesToday)
  const driverHoursOnline = useAppStore((state) => state.driverHoursOnline)
  const [availabilityError, setAvailabilityError] = useState('')
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false)

  const handleAvailabilityChange = async (nextAvailable) => {
    if (isUpdatingAvailability) return
    setAvailabilityError('')
    if (isDemoMode) {
      setDriverAvailable(nextAvailable)
      return
    }

    setIsUpdatingAvailability(true)
    try {
      const result = await getDispatchService().setDriverAvailability(nextAvailable)
      setDriverAvailable(result.available)
    } catch (error) {
      setAvailabilityError(error.message || 'La disponibilité n’a pas pu être mise à jour.')
    } finally {
      setIsUpdatingAvailability(false)
    }
  }

  return (
    <div className="relative flex h-full min-h-[700px] flex-1 overflow-hidden bg-[#dcebe8]">
      <div className="absolute inset-x-0 top-0 z-20 px-5 py-4 flex items-center justify-between bg-white/90 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-taga-mango text-white flex items-center justify-center font-bold">YA</div>
          <div>
            <p className="text-xs text-gray-400">BONJOUR, CHEF</p>
            <p className="font-bold text-sm">Yao Aristide</p>
          </div>
        </div>
        <span aria-live="polite" className={`flex items-center gap-1 text-xs font-semibold ${driverAvailable ? 'text-taga-green' : 'text-gray-400'}`}>
          <span>●</span> {driverAvailable ? 'EN LIGNE' : 'HORS LIGNE'}
        </span>
      </div>

      <MapView className="absolute inset-0 z-0 h-full min-h-[700px] w-full" aria-label="Carte de disponibilité chauffeur">
        <div className="absolute left-1/2 top-[42%] flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
          <span className="absolute h-44 w-44 animate-pulse rounded-full bg-taga-green/20" />
          <span className="absolute h-28 w-28 rounded-full bg-taga-green/30" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-taga-green text-white shadow-lg"><Icon name="car" size={27} /></span>
        </div>
      </MapView>

      <div className="absolute inset-x-0 bottom-0 z-10 max-h-[48%] overflow-y-auto rounded-t-3xl bg-white px-4 pb-2 pt-4 text-gray-900 shadow-[0_-8px_24px_rgba(10,17,40,0.18)] flex flex-col gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-taga-navy via-taga-navy to-[#6a4d4d] px-4 py-3 text-white">
          <div className="flex items-start justify-between">
            <p className="text-[10px] font-semibold text-white/65">TES GAINS AUJOURD'HUI</p>
            <p className="text-[10px] text-white/55">SAM. 24 AVR.</p>
          </div>
          <AmountTile amount={driverEarningsToday} size="xl" tone="light" />
          <p className="mt-1 text-[10px] text-white/65">Courses · {driverRidesToday} · En ligne · {driverHoursOnline} · Note · 4.91 ★</p>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-taga-green/10 px-3 py-2">
          <ToggleSwitch
            id="availability-toggle"
            checked={driverAvailable}
            onChange={handleAvailabilityChange}
            label="Disponible pour course"
          />
          {isDemoMode && driverAvailable && (
            <button type="button" onClick={() => navigate(ROUTES.driverIncomingRequest)} className="rounded-lg bg-taga-mango px-3 py-2 text-xs font-bold text-white">
              Simuler →
            </button>
          )}
        </div>

        {availabilityError && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-600" role="alert">
            {availabilityError}
          </p>
        )}

        {!isDemoMode && (
          <p className="text-[10px] leading-4 text-gray-400" role="status" aria-live="polite">
            {isUpdatingAvailability ? 'Synchronisation de ta disponibilité…' : 'La disponibilité est contrôlée par le serveur.'}
          </p>
        )}

        <div className="flex items-center gap-3 rounded-xl bg-[#fff5e8] px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-taga-mango/20 text-taga-mango"><Icon name="target" size={16} /></div>
          <div>
            <p className="text-xs font-semibold text-gray-800">Bonus +5 000 F</p>
            <p className="text-[10px] text-gray-400">13/18 courses cette semaine · plus que 5</p>
            <div className="mt-1.5 h-1.5 w-44 max-w-full overflow-hidden rounded-full bg-taga-mango/15">
              <div className="h-full w-[72%] rounded-full bg-taga-mango" />
            </div>
          </div>
        </div>

        <nav aria-label="Navigation chauffeur" className="grid grid-cols-4 border-t border-gray-100 pt-2">
          {DRIVER_NAV_ITEMS.map((item) => {
            const active = location.pathname === item.path
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(item.path)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 flex-col items-center justify-center gap-1 text-xs transition-opacity ${
                  active ? 'font-semibold text-taga-blue' : 'text-gray-400'
                }`}
              >
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
