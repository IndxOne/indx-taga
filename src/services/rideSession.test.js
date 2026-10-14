import { beforeEach, describe, expect, it } from 'vitest'
import { forgetRide, isRideClosed, markRideClosed, recallRide, rememberRide, resetRideSessionForTests } from './rideSession'
import { classifyRideReadError } from './rideErrors'

beforeEach(() => resetRideSessionForTests())

describe('rideSession', () => {
  it('mémorise puis oublie la course suivie', () => {
    expect(recallRide()).toBeNull()
    rememberRide('ride-1')
    expect(recallRide()).toBe('ride-1')
    forgetRide()
    expect(recallRide()).toBeNull()
  })

  it('ignore les identifiants invalides', () => {
    rememberRide('')
    rememberRide(null)
    markRideClosed(undefined)
    expect(recallRide()).toBeNull()
    expect(isRideClosed('')).toBe(false)
  })

  it('une clôture est durable pour l’onglet et oublie la course suivie correspondante', () => {
    rememberRide('ride-1')
    markRideClosed('ride-1')
    expect(isRideClosed('ride-1')).toBe(true)
    expect(isRideClosed('ride-2')).toBe(false)
    expect(recallRide()).toBeNull()
  })

  it('conserve la clôture quand sessionStorage est indisponible', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { throw new Error('blocked') } })
    try {
      rememberRide('ride-9')
      markRideClosed('ride-9')
      expect(isRideClosed('ride-9')).toBe(true)
    } finally {
      Object.defineProperty(globalThis, 'sessionStorage', original)
    }
  })
})

describe('classifyRideReadError', () => {
  it.each([[{ code: '42501' }], [{ code: 'forbidden' }], [{ code: 'unauthenticated' }], [{ status: 401 }], [{ status: 403 }]])(
    '%j → forbidden',
    (error) => expect(classifyRideReadError(error)).toBe('forbidden'),
  )

  it.each([[new Error('Failed to fetch')], [{ code: 'PGRST301' }], [null], [undefined]])(
    '%j → error',
    (error) => expect(classifyRideReadError(error)).toBe('error'),
  )
})
