import Icon from '../Icon'

export default function RetryError({ icon = 'alert', title, subtitle, onRetry, retryLabel = 'Réessayer' }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-12" role="alert">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
        <Icon name={icon} size={24} />
      </div>
      <p className="font-semibold text-gray-700">{title}</p>
      {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-4 text-sm font-semibold text-taga-blue">
          {retryLabel}
        </button>
      )}
    </div>
  )
}
