import { describe, expect, it } from 'vitest'
import { canAccessRole } from './accessControl'

describe('canAccessRole', () => {
  it('autorise uniquement le rôle demandé', () => {
    expect(canAccessRole('passenger', 'passenger')).toBe(true)
    expect(canAccessRole('passenger', 'driver')).toBe(false)
    expect(canAccessRole('driver', 'passenger')).toBe(false)
  })

  it('laisse les espaces partagés accessibles sans rôle spécifique', () => {
    expect(canAccessRole(undefined, 'passenger')).toBe(true)
    expect(canAccessRole(undefined, 'driver')).toBe(true)
  })
})
