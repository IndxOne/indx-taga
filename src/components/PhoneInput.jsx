export default function PhoneInput({ value, onChange }) {
  return (
    <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-3">
      <span className="text-sm text-gray-500 shrink-0">🇨🇮 +225</span>
      <input
        type="tel"
        inputMode="numeric"
        placeholder="07 07 12 34 56"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 outline-none text-base"
      />
    </div>
  )
}
