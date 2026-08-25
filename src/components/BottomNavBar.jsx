import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { CLIENT_NAV_ITEMS, DRIVER_NAV_ITEMS } from '../navigation/routes'
import Icon from './Icon'

export default function BottomNavBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const role = useAppStore((state) => state.role)
  const tabs = role === 'driver' ? DRIVER_NAV_ITEMS : CLIENT_NAV_ITEMS

  return (
    <nav aria-label="Navigation principale" className="flex items-center justify-around border-t border-gray-100 bg-white px-2 py-2">
      {tabs.map((tab) => {
        const active = location.pathname === tab.path
        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => navigate(tab.path)}
            aria-current={active ? 'page' : undefined}
            aria-label={tab.label}
            className={`flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 px-3 py-1 text-xs ${active ? 'text-taga-blue font-semibold' : 'text-gray-400'}`}
          >
            <Icon name={tab.icon} size={18} />
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
