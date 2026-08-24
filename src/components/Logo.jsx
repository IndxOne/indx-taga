const WORD_COLOR = {
  light: 'text-white',
  dark: 'text-taga-blue',
}

export default function Logo({ tone = 'light', size = 'md' }) {
  const isLarge = size === 'lg'
  return (
    <div className="inline-flex flex-col items-start gap-0.5" aria-label="Taga">
      <span className={`block -skew-x-12 rounded-sm bg-taga-green ${isLarge ? 'ml-1 h-2 w-10' : 'ml-0.5 h-1.5 w-8'}`} />
      <span className={`font-extrabold italic leading-none tracking-[-0.08em] ${isLarge ? 'text-3xl' : 'text-2xl'} ${WORD_COLOR[tone]}`}>
        taga
      </span>
    </div>
  )
}
