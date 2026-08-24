import { useRef } from 'react'

export default function OtpInput({ value, onChange, length = 6 }) {
  const inputsRef = useRef([])
  const digits = value.padEnd(length, ' ').split('').slice(0, length)

  const handleChange = (index, rawChar) => {
    const chars = rawChar.replace(/\D/g, '').slice(0, length - index).split('')
    const char = chars[0] || ''
    const next = value.split('')
    if (chars.length > 0) {
      chars.forEach((item, offset) => {
        next[index + offset] = item
      })
    } else {
      next.splice(index, 1)
    }
    const joined = next.join('').slice(0, length).replace(/\s/g, '')
    onChange(joined)
    if (chars.length > 1) {
      inputsRef.current[Math.min(index + chars.length, length - 1)]?.focus()
    } else if (char && index < length - 1) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index]?.trim() && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  return (
    <div className="flex gap-2 justify-center" role="group" aria-label="Code de vérification à six chiffres">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (inputsRef.current[index] = el)}
          type="tel"
          inputMode="numeric"
          maxLength={1}
          aria-label={`Chiffre ${index + 1} sur ${length}`}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          autoFocus={index === 0}
          value={digit.trim()}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          className="w-11 h-12 text-center text-lg font-bold rounded-xl border border-gray-200 outline-none focus:border-taga-blue"
        />
      ))}
    </div>
  )
}
