import Icon from './Icon'

export default function EmptyState({ icon = 'route', title, subtitle }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-12">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-taga-blue"><Icon name={icon} size={24} /></div>
      <p className="font-semibold text-gray-700">{title}</p>
      {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
    </div>
  )
}
