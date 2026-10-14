import { describe, expect, it } from 'vitest'
import { DEV_TEST_PASSENGER_PHONE, normalizePhone, usesTestPassengerPhone } from './phone'

describe('numéro de test passager', () => {
  it('ne s’applique qu’en démo, en développement local, pour un passager', () => {
    expect(usesTestPassengerPhone({ demo: true, dev: true, role: 'passenger' })).toBe(true)
  })

  it('ne s’applique jamais en mode réel, même en développement local', () => {
    expect(usesTestPassengerPhone({ demo: false, dev: true, role: 'passenger' })).toBe(false)
  })

  it('ne s’applique ni en build de production ni aux chauffeurs', () => {
    expect(usesTestPassengerPhone({ demo: true, dev: false, role: 'passenger' })).toBe(false)
    expect(usesTestPassengerPhone({ demo: true, dev: true, role: 'driver' })).toBe(false)
    expect(usesTestPassengerPhone({ demo: true, dev: true, role: null })).toBe(false)
  })

  it('le numéro saisi reste normalisé quand aucune substitution n’a lieu', () => {
    const typed = normalizePhone('07 07 12 34 56')
    expect(typed.startsWith('+225')).toBe(true)
    expect(typed).not.toBe(DEV_TEST_PASSENGER_PHONE)
  })
})
