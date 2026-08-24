export default function RoleCard({ icon, badge, badgeColor = 'bg-taga-mango', title, subtitle, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left bg-white/10 hover:bg-white/15 rounded-2xl p-5 flex items-start gap-4 transition-colors"
    >
      <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <span className={`inline-block text-xs font-semibold text-white px-2 py-0.5 rounded-full mb-2 ${badgeColor}`}>
          {badge}
        </span>
        <h3 className="text-white font-bold text-lg">{title}</h3>
        <p className="text-white/70 text-sm mt-1">{subtitle}</p>
      </div>
      <span className="text-white/50 text-xl self-center">→</span>
    </button>
  )
}
