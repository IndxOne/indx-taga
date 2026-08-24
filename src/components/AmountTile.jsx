const SIZES = { md: 'text-lg', xl: 'text-4xl' }
const TONES = { default: 'text-gray-900', light: 'text-white' }

export default function AmountTile({ label, amount, size = 'md', tone = 'default' }) {
  const formatted = new Intl.NumberFormat('fr-FR').format(amount)
  return (
    <div>
      {label && <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">{label}</p>}
      <p className={`font-bold ${SIZES[size]} ${TONES[tone]}`}>
        {formatted} <span className="text-sm font-normal">FCFA</span>
      </p>
    </div>
  )
}
