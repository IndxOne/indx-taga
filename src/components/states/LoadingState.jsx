export default function LoadingState({ label = 'Chargement...' }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 py-12" role="status" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-taga-blue/20 border-t-taga-blue" aria-hidden="true" />
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  )
}
