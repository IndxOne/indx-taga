export default function PhoneInput({ value, onChange }) {
  return (
    <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-3">
      <span className="flex items-center gap-1.5 text-sm text-gray-600 shrink-0">
        <span className="text-[10px] font-bold bg-gray-100 text-gray-500 rounded px-1 py-0.5">CI</span>
        +225
      </span>
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
