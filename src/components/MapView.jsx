export default function MapView({ children, className = '' }) {
  return (
    <div
      className={`relative overflow-hidden bg-gray-100 ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {children}
    </div>
  )
}
