import { useRef } from 'react'

export default function OtpInput({ value, onChange, length = 6 }) {
  const inputsRef = useRef([])
  const digits = value.padEnd(length, ' ').split('').slice(0, length)

  const handleChange = (index, rawChar) => {
    const char = rawChar.replace(/\D/g, '').slice(-1)
    const next = value.split('')
    next[index] = char
    const joined = next.join('').slice(0, length).replace(/\s/g, '')
    onChange(joined)
    if (char && index < length - 1) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index]?.trim() && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  return (
    <div className="flex gap-2 justify-center">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (inputsRef.current[index] = el)}
          type="tel"
          inputMode="numeric"
          maxLength={1}
          value={digit.trim()}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          className="w-11 h-12 text-center text-lg font-bold rounded-xl border border-gray-200 outline-none focus:border-taga-blue"
        />
      ))}
    </div>
  )
}
