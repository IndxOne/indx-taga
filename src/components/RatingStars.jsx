import { useState } from 'react'

export default function RatingStars({ value, onChange, readOnly = false }) {
  const [hover, setHover] = useState(0)
  const display = hover || value

  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readOnly && setHover(star)}
          onMouseLeave={() => !readOnly && setHover(0)}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
            star <= display ? 'bg-taga-green text-white' : 'bg-gray-100 text-gray-400'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  )
}
