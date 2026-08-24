export default function ToggleSwitch({ id, checked, onChange, label }) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 text-sm font-medium cursor-pointer select-none">
      <span className="relative inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-white/25 transition-colors peer-checked:bg-taga-green" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
      {label}
    </label>
  )
}
