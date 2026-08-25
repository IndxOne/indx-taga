import Icon from './Icon'

export default function RideHistoryTile({ ride, mode = 'passenger' }) {
  const amount = mode === 'driver' ? ride.driverAmount : ride.amount
  const formatted = new Intl.NumberFormat('fr-FR').format(amount)

  return (
    <div className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-b-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-taga-blue"><Icon name="receipt" size={17} /></div>
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
