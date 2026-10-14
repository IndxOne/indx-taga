import { describe, expect, it } from 'vitest'
import { DEV_TEST_PASSENGER_PHONE, maskPhone, normalizePhone, usesTestPassengerPhone } from './phone'

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
})

describe('normalizePhone — numéros ivoiriens à 10 chiffres', () => {
  it.each([
    ['07 07 12 34 56', '+2250707123456'],
    ['0707123456', '+2250707123456'],
    ['+225 07 07 12 34 56', '+2250707123456'],
    ['+2250707123456', '+2250707123456'],
    ['225 07 07 12 34 56', '+2250707123456'],
    ['00225 07 07 12 34 56', '+2250707123456'],
    ['(07) 07.12.34-56', '+2250707123456'],
    ['  01 02 03 04 05 ', '+2250102030405'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })

  it('les formats national et international donnent exactement le même résultat', () => {
    expect(normalizePhone('07 07 12 34 56')).toBe(normalizePhone('+225 07 07 12 34 56'))
  })

  it('préserve le zéro initial (ne le retire plus)', () => {
    expect(normalizePhone('07 07 12 34 56')).not.toBe('+225707123456')
  })

  it.each([
    ['vide', ''],
    ['null', null],
    ['undefined', undefined],
    ['trop court (9 chiffres)', '07 07 12 34 5'],
    ['trop court (anciens 8 chiffres)', '07 12 34 56'],
    ['trop long (11 chiffres)', '07 07 12 34 56 7'],
    ['+225 sans le zéro (9 chiffres)', '+225 7 07 12 34 56'],
    ['+225 trop long', '+225 07 07 12 34 56 7'],
    ['lettres', '07 07 12 34 AB'],
    ['plus au milieu', '07+07123456'],
    ['indicatif seul', '+225'],
    ['E.164 étranger trop court', '+33 1234'],
    ['E.164 étranger trop long', '+3312345678901234'],
  ])('refuse : %s', (_label, input) => {
    expect(normalizePhone(input)).toBe('')
  })

  it('accepte un E.164 étranger valide (numéro de test démo)', () => {
    expect(normalizePhone(DEV_TEST_PASSENGER_PHONE)).toBe(DEV_TEST_PASSENGER_PHONE)
    expect(normalizePhone('+33 7 75 67 90 67')).toBe('+33775679067')
  })

  it('le masquage ne casse pas sur une entrée invalide', () => {
    expect(maskPhone('abc')).toBe('')
    expect(maskPhone('07 07 12 34 56')).toMatch(/^\+225/)
  })
})
