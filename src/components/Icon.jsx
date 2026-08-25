const PATHS = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></>,
  receipt: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2Z" /><path d="M8 8h8M8 12h8M8 16h4" /></>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  user: <><circle cx="12" cy="8" r="3" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
  car: <><path d="m5 16 1.5-6h11L19 16" /><path d="M3 16h18v4H3zM6 20v1M18 20v1" /><circle cx="7" cy="17" r="1" /><circle cx="17" cy="17" r="1" /></>,
  wallet: <><path d="M4 6h16v14H4z" /><path d="M4 6V4h13" /><path d="M15 12h5v4h-5a2 2 0 0 1 0-4Z" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5h8v2M3 12h18M10 12v2h4v-2" /></>,
  taxi: <><path d="M5 17 6.5 9h11l1.5 8" /><path d="M3 17h18v3H3zM7 20v1M17 20v1" /><circle cx="7" cy="18" r="1" /><circle cx="17" cy="18" r="1" /><path d="M9 9 10 6h4l1 3" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  message: <><path d="M4 5h16v11H8l-4 4Z" /><path d="M8 9h8M8 12h5" /></>,
  phone: <><path d="M6 3h3l2 5-2 1c1 2 2 3 4 4l1-2 5 2v3c0 1-1 2-2 2C10 18 6 14 4 7c0-2 1-4 2-4Z" /></>,
  route: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18c7 0 1-8 10-10" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  arrowRight: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  arrowUp: <><path d="M12 19V5M6 11l6-6 6 6" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
  alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /></>,
  refresh: <><path d="M21 12a9 9 0 0 1-15.5 6.3M3 12a9 9 0 0 1 15.5-6.3" /><path d="M21 3v6h-6M3 21v-6h6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
}

export default function Icon({ name, size = 20, strokeWidth = 1.8, className = '', label }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    >
      {PATHS[name] ?? PATHS.pin}
    </svg>
  )
}
