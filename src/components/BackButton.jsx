import { useNavigate } from 'react-router-dom'

export default function BackButton({ to, label = 'Retour' }) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-xl text-taga-navy shadow-md backdrop-blur-sm transition-transform active:scale-95"
    >
      <span aria-hidden="true">‹</span>
    </button>
  )
}
