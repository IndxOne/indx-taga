const PHASE_CONFIG = {
  request: {
    driver: { left: '22%', top: '68%' },
    pickup: { left: '52%', top: '44%' },
    destination: { left: '78%', top: '20%' },
    label: 'Nouvelle course',
  },
  navigation: {
    driver: { left: '33%', top: '58%' },
    pickup: { left: '52%', top: '44%' },
    destination: { left: '78%', top: '20%' },
    label: 'Vers le passager',
  },
  'in-progress': {
    driver: { left: '57%', top: '38%' },
    pickup: { left: '28%', top: '72%' },
    destination: { left: '78%', top: '20%' },
    label: 'Course en cours',
  },
}

function MapMarker({ type, position, label }) {
  const styles = {
    driver: 'bg-taga-green text-white ring-4 ring-taga-green/20',
    pickup: 'bg-white text-taga-green border-2 border-taga-green',
    destination: 'bg-taga-navy text-white',
  }

  return (
    <div
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={position}
      aria-label={label}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm shadow-lg ${styles[type]}`}>
        {type === 'driver' ? <Icon name="car" size={15} /> : type === 'pickup' ? <Icon name="pin" size={15} /> : <Icon name="route" size={15} />}
      </div>
      <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold text-gray-600 shadow-sm">
        {label}
      </span>
    </div>
  )
}

export default function DriverRideMap({ phase = 'request' }) {
  const config = PHASE_CONFIG[phase] ?? PHASE_CONFIG.request

  return (
    <>
      <svg className="pointer-events-none absolute inset-0 z-[1] h-full w-full" viewBox="0 0 430 320" preserveAspectRatio="none" aria-hidden="true">
        <path d="M95 230 C140 204 184 178 224 141 S306 86 335 64" fill="none" stroke="#ffffff" strokeWidth="12" strokeLinecap="round" />
        <path d="M95 230 C140 204 184 178 224 141 S306 86 335 64" fill="none" stroke="#00a878" strokeWidth="4" strokeLinecap="round" strokeDasharray="10 7" />
      </svg>
      <div className={`pointer-events-none absolute top-16 z-[2] rounded-lg bg-taga-navy px-2.5 py-1.5 text-[10px] font-semibold text-white shadow-md ${phase === 'request' ? 'left-16' : 'left-4'}`}>
        {config.label}
      </div>
      <MapMarker type="driver" position={config.driver} label="Vous" />
      <MapMarker type="pickup" position={config.pickup} label="Prise en charge" />
      <MapMarker type="destination" position={config.destination} label="Destination" />
    </>
  )
}
import Icon from './Icon'
