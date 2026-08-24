export default function EmptyState({ icon = '📭', title, subtitle }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-12">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl mb-3">{icon}</div>
      <p className="font-semibold text-gray-700">{title}</p>
      {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
    </div>
  )
}
