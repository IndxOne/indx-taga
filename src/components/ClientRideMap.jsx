const PHASES = {
  estimate: {
    pickup: { left: '28%', top: '68%' },
    dropoff: { left: '74%', top: '22%' },
  },
  active: {
    pickup: { left: '28%', top: '72%' },
    driver: { left: '58%', top: '38%' },
    dropoff: { left: '78%', top: '18%' },
  },
}

function Marker({ type, position, label }) {
  const styles = {
    pickup: 'bg-white border-2 border-taga-green text-taga-green',
    driver: 'bg-taga-blue text-white ring-4 ring-taga-blue/20',
    dropoff: 'bg-taga-navy text-white',
  }

  return (
    <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={position} aria-label={label}>
      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs shadow-md ${styles[type]}`}>
        {type === 'driver' ? <Icon name="car" size={15} /> : type === 'pickup' ? <Icon name="pin" size={15} /> : <Icon name="route" size={15} />}
      </div>
      {type === 'driver' && (
        <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-taga-blue px-2 py-1 text-[9px] font-semibold text-white shadow-sm">
          Mamadou · 3 min
        </span>
      )}
    </div>
  )
}

export default function ClientRideMap({ phase = 'estimate' }) {
  const config = PHASES[phase] ?? PHASES.estimate
  const end = phase === 'active' ? 'M120 245 C160 214 198 178 244 140 S305 83 336 58' : 'M120 245 C164 210 208 178 250 142 S305 83 320 58'

  return (
    <>
      <svg className="pointer-events-none absolute inset-0 z-[1] h-full w-full" viewBox="0 0 430 320" preserveAspectRatio="none" aria-hidden="true">
        <path d={end} fill="none" stroke="#ffffff" strokeWidth="12" strokeLinecap="round" />
        <path d={end} fill="none" stroke="#0005d6" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <div className={`absolute right-32 top-4 z-[2] rounded-xl bg-white/95 px-3 py-2 shadow-md ${phase === 'estimate' ? 'left-16' : 'left-4'}`}>
        <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Trajet</p>
        <p className="text-xs font-semibold text-taga-navy">Cocody, Riviera 3 <span className="text-gray-300">→</span> Plateau, Imm. CAISTAB</p>
      </div>
      <Marker type="pickup" position={config.pickup} label="Point de prise en charge" />
      {config.driver && <Marker type="driver" position={config.driver} label="Chauffeur" />}
      <Marker type="dropoff" position={config.dropoff} label="Destination" />
    </>
  )
}
import Icon from './Icon'
