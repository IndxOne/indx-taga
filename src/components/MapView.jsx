import { isDemoMode } from '../services/runtimeConfig'

export default function MapView({ children, className = '', 'aria-label': ariaLabel = 'Carte de la zone de trajet', ...attributes }) {
  return (
    <div
      {...attributes}
      className={`relative overflow-hidden bg-[#dcebe8] ${className}`}
      role="region"
      aria-label={ariaLabel}
      style={{
        backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,.45) 25%, transparent 25%), linear-gradient(315deg, rgba(255,255,255,.32) 25%, transparent 25%)',
        backgroundSize: '52px 52px',
      }}
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 430 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path d="M-20 270 C80 238 116 270 190 218 S310 90 450 118" fill="none" stroke="#cdd9dd" strokeWidth="44" />
        <path d="M-20 270 C80 238 116 270 190 218 S310 90 450 118" fill="none" stroke="#ffffff" strokeWidth="30" />
        <path d="M-20 270 C80 238 116 270 190 218 S310 90 450 118" fill="none" stroke="#f7c948" strokeWidth="1.5" strokeDasharray="8 7" />
        <path d="M65 -20 C96 55 128 112 171 162 S263 260 282 340" fill="none" stroke="#ffffff" strokeWidth="18" />
        <path d="M65 -20 C96 55 128 112 171 162 S263 260 282 340" fill="none" stroke="#d5dfe2" strokeWidth="2" />
        <path d="M365 -20 C338 58 330 106 346 156 S403 255 420 340" fill="none" stroke="#ffffff" strokeWidth="14" />
        <path d="M365 -20 C338 58 330 106 346 156 S403 255 420 340" fill="none" stroke="#d5dfe2" strokeWidth="2" />
        <path d="M0 76 L115 92 L210 70 L300 78 L430 52" fill="none" stroke="#ffffff" strokeWidth="10" />
        <path d="M0 76 L115 92 L210 70 L300 78 L430 52" fill="none" stroke="#d5dfe2" strokeWidth="1.5" />
        <path d="M0 164 L100 152 L190 166 L280 145 L430 174" fill="none" stroke="#ffffff" strokeWidth="8" />
        <path d="M0 164 L100 152 L190 166 L280 145 L430 174" fill="none" stroke="#d5dfe2" strokeWidth="1.5" />

        <path d="M0 0 H130 C115 38 118 78 88 105 C60 130 25 108 0 122Z" fill="#cce8e2" />
        <path d="M0 0 H130 C115 38 118 78 88 105 C60 130 25 108 0 122Z" fill="none" stroke="#acd6ce" strokeWidth="2" />

        <g fill="#d8e0e1" stroke="#c3ced0" strokeWidth="1">
          <rect x="170" y="18" width="42" height="25" rx="3" />
          <rect x="224" y="14" width="70" height="34" rx="3" />
          <rect x="312" y="12" width="38" height="26" rx="3" />
          <rect x="122" y="102" width="34" height="30" rx="3" />
          <rect x="195" y="94" width="54" height="32" rx="3" />
          <rect x="272" y="100" width="42" height="25" rx="3" />
          <rect x="38" y="190" width="52" height="34" rx="3" />
          <rect x="104" y="182" width="42" height="30" rx="3" />
          <rect x="304" y="205" width="56" height="34" rx="3" />
          <rect x="370" y="196" width="38" height="28" rx="3" />
        </g>

        {isDemoMode && (
          <g fill="#7f9498" fontFamily="sans-serif" fontSize="9" fontWeight="600">
            <text x="18" y="145">Cocody</text>
            <text x="218" y="62">Riviera 3</text>
            <text x="330" y="187">Plateau</text>
            <text x="24" y="298">Boulevard Latrille</text>
          </g>
        )}
      </svg>

      <div className="pointer-events-none absolute right-4 top-4 z-[1] rounded-lg bg-white/90 px-2 py-1 text-[10px] font-semibold text-gray-500 shadow-sm">
        Carte SVG · aperçu
      </div>
      {children}
    </div>
  )
}
