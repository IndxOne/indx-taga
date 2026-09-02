import Icon from './Icon'

export default function RideOptionCard({ name, badge, description, price, originalPrice, selected, onSelect, showPrice = true }) {
  const formatted = (n) => new Intl.NumberFormat('fr-FR').format(n)
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full text-left border-2 rounded-xl p-4 flex items-center gap-3 transition-colors ${
        selected ? 'border-taga-blue bg-taga-blue/5' : 'border-gray-100'
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-taga-blue"><Icon name="car" size={19} /></div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{name}</span>
          {badge && (
            <span className="text-xs font-semibold text-taga-green bg-taga-green/10 px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <div className="text-right shrink-0">
        {showPrice ? (
          <>
            {originalPrice && <p className="text-xs text-gray-400 line-through">{formatted(originalPrice)} F</p>}
            <p className="font-bold">{formatted(price)} F</p>
          </>
        ) : (
          <p className="max-w-20 text-[10px] leading-4 text-gray-400">Tarif à confirmer</p>
        )}
      </div>
    </button>
  )
}
