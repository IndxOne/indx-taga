const WORD_COLOR = {
  light: 'text-white',
  dark: 'text-taga-blue',
}

export default function Logo({ tone = 'light', size = 'md' }) {
  const isLarge = size === 'lg'
  return (
    <div className="inline-flex flex-col items-start gap-1">
      <span className={`block rounded-sm bg-taga-green ${isLarge ? 'w-9 h-2' : 'w-7 h-1.5'}`} />
      <span className={`font-extrabold leading-none tracking-tight ${isLarge ? 'text-3xl' : 'text-2xl'} ${WORD_COLOR[tone]}`}>
        aga
      </span>
    </div>
  )
}
