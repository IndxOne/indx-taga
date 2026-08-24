const PROVIDER_STYLE = {
  orange_money: { bg: 'bg-orange-500', label: 'OM' },
  wave: { bg: 'bg-sky-500', label: 'WV' },
}

export default function PaymentMethodTile({ method, onSetDefault, onRemove }) {
  const style = PROVIDER_STYLE[method.provider] ?? { bg: 'bg-gray-400', label: '?' }

  return (
    <div className="flex items-center gap-3 border border-gray-100 rounded-xl px-4 py-3">
      <div className={`w-9 h-9 rounded-lg text-white text-xs font-bold flex items-center justify-center shrink-0 ${style.bg}`}>
        {style.label}
      </div>
      <div className="flex-1">
        <p className="font-semibold text-sm">{method.label}</p>
        <p className="text-xs text-gray-400">{method.maskedNumber}</p>
      </div>
      {method.isDefault ? (
        <span className="text-xs font-semibold text-taga-green bg-taga-green/10 px-2 py-0.5 rounded-full">Par défaut</span>
      ) : (
        <button type="button" onClick={() => onSetDefault?.(method.id)} className="text-xs font-semibold text-taga-blue">
          Définir par défaut
        </button>
      )}
      {onRemove && (
        <button type="button" onClick={() => onRemove(method.id)} aria-label="Supprimer" className="text-gray-300 text-sm">
          ✕
        </button>
      )}
    </div>
  )
}
