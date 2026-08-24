export default function DriverInfoCard({ driver }) {
  const initials = driver.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)

  return (
    <div className="bg-white rounded-2xl p-4 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-taga-blue text-white flex items-center justify-center font-bold shrink-0">
          {initials}
        </div>
        <div className="flex-1">
          <p className="font-bold">{driver.name}</p>
          <p className="text-sm text-gray-500">
            ★ {driver.rating} · {driver.yearsExperience} ans
          </p>
        </div>
        <button type="button" aria-label="Message" className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
          💬
        </button>
        <button type="button" aria-label="Appeler" className="w-10 h-10 rounded-full bg-taga-green text-white flex items-center justify-center">
          📞
        </button>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
        <span className="text-gray-500">Véhicule</span>
        <span className="font-semibold">
          {driver.vehicle.model} · {driver.vehicle.color}
        </span>
        <span className="text-xs font-mono border border-gray-200 rounded px-2 py-0.5">{driver.vehicle.plate}</span>
      </div>
    </div>
  )
}
