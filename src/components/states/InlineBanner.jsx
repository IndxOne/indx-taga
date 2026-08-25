import Icon from '../Icon'

const VARIANTS = {
  pending: { className: 'bg-taga-blue/5 text-taga-blue', icon: 'refresh' },
  success: { className: 'bg-taga-green/10 text-taga-green', icon: 'check' },
  error: { className: 'bg-red-50 text-red-500', icon: 'alert' },
}

export default function InlineBanner({ variant = 'pending', children }) {
  const { className, icon } = VARIANTS[variant] ?? VARIANTS.pending
  return (
    <p
      role={variant === 'error' ? 'alert' : 'status'}
      className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-center text-xs ${className}`}
    >
      <Icon name={icon} size={14} className={variant === 'pending' ? 'animate-spin' : ''} />
      {children}
    </p>
  )
}
