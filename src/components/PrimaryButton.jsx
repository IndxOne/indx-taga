const VARIANTS = {
  navy: 'bg-taga-navy text-white',
  green: 'bg-taga-green text-white',
  mango: 'bg-taga-mango text-white',
}

export default function PrimaryButton({ children, onClick, variant = 'navy', disabled = false, type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-4 rounded-xl font-semibold text-base transition-opacity disabled:opacity-40 disabled:cursor-not-allowed ${VARIANTS[variant]}`}
    >
      {children}
    </button>
  )
}
