export default function RoleCard({ icon, badge, badgeColor = 'bg-taga-mango', iconBg = 'bg-taga-mango', title, subtitle, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-2xl border border-white/10 bg-white/[0.08] p-4 text-left transition-colors hover:bg-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl shadow-sm ${iconBg}`}>
          {icon}
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold tracking-wide text-white ${badgeColor}`}>
          {badge}
        </span>
      </div>
      <div className="mt-4">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-white/65">{subtitle}</p>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
        <span className={`text-[10px] font-bold tracking-wide ${badgeColor.replace('bg-', 'text-')}`}>CONTINUER</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold text-white ${badgeColor}`} aria-hidden="true">→</span>
      </div>
    </button>
  )
}
