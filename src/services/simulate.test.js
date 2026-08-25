import { afterEach, describe, expect, it, vi } from 'vitest'
import { simulate } from './simulate'

describe('simulate', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves with the result when the roll is above failRate', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    const result = await simulate('ok', { failRate: 0.5, delay: [0, 0] })
    expect(result).toBe('ok')
  })

  it('accepts a lazy result function', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    const result = await simulate(() => ({ value: 42 }), { failRate: 0, delay: [0, 0] })
    expect(result).toEqual({ value: 42 })
  })

  it('rejects with the given error message when the roll is below failRate', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1)
    await expect(
      simulate('ok', { failRate: 0.5, delay: [0, 0], errorMessage: 'nope' }),
    ).rejects.toThrow('nope')
  })

  it('tags the rejected error with a kind resolved from errorKinds', async () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0) // duration roll
      .mockReturnValueOnce(0.1) // fail roll (below failRate 0.5)
      .mockReturnValueOnce(0.9) // kind-index roll -> picks last entry

    await simulate('ok', {
      failRate: 0.5,
      delay: [0, 0],
      errorKinds: ['network', 'unavailable'],
      errorMessage: { network: 'net', unavailable: 'unavail' },
    }).catch((err) => {
      expect(err.kind).toBe('unavailable')
      expect(err.message).toBe('unavail')
    })
  })

  it('defaults to a network kind and generic message', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1)
    await simulate('ok', { failRate: 1, delay: [0, 0] }).catch((err) => {
      expect(err.kind).toBe('network')
      expect(err.message).toBe('Une erreur est survenue.')
    })
  })
})
