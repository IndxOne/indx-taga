export default function ToggleSwitch({ id, checked, onChange, label, disabled = false }) {
  return (
    <label htmlFor={id} className={`flex items-center gap-3 text-sm font-medium select-none ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
      <span className="relative inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-gray-300 transition-colors peer-checked:bg-taga-green peer-focus-visible:ring-2 peer-focus-visible:ring-taga-blue peer-focus-visible:ring-offset-2" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
      {label}
    </label>
  )
}
