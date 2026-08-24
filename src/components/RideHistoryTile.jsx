export default function RideHistoryTile({ ride, mode = 'passenger' }) {
  const amount = mode === 'driver' ? ride.driverAmount : ride.amount
  const formatted = new Intl.NumberFormat('fr-FR').format(amount)

  return (
    <div className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-b-0">
      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-sm shrink-0">🧾</div>
      <div className="flex-1">
        <p className="font-semibold text-sm">
          {ride.pickupLabel.split(',')[0]} → {ride.dropoffLabel.split(',')[0]}
        </p>
        <p className="text-xs text-gray-400">{ride.date}</p>
      </div>
      <p className={`font-bold text-sm ${mode === 'driver' ? 'text-taga-green' : 'text-gray-900'}`}>
        {mode === 'driver' ? '+' : ''}
        {formatted} F
      </p>
    </div>
  )
}
