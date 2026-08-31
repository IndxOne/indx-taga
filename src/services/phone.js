export function normalizePhone(value) {
  const input = String(value ?? '').trim()
  if (input.startsWith('+')) return `+${input.slice(1).replace(/\D/g, '')}`

  const digits = input.replace(/\D/g, '')
  if (digits.startsWith('225')) return `+${digits}`
  if (digits.startsWith('0')) return `+225${digits.slice(1)}`
  return digits ? `+${digits}` : ''
}

export function maskPhone(value) {
  const normalized = normalizePhone(value)
  if (normalized.length < 7) return normalized
  return `${normalized.slice(0, 4)} ${'•'.repeat(Math.max(2, normalized.length - 7))} ${normalized.slice(-3)}`
}
