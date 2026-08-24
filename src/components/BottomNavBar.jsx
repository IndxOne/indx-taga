import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { CLIENT_NAV_ITEMS, DRIVER_NAV_ITEMS } from '../navigation/routes'

export default function BottomNavBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const role = useAppStore((state) => state.role)
  const tabs = role === 'driver' ? DRIVER_NAV_ITEMS : CLIENT_NAV_ITEMS

  return (
    <div className="flex items-center justify-around border-t border-gray-100 bg-white px-2 py-2">
      {tabs.map((tab) => {
        const active = location.pathname === tab.path
        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => navigate(tab.path)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${active ? 'text-taga-blue font-semibold' : 'text-gray-400'}`}
          >
            <span className="text-base">{tab.icon}</span>
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
