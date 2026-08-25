import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAsyncAction } from './useAsyncAction'

describe('useAsyncAction', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useAsyncAction(() => Promise.resolve('ok')))
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
  })

  it('transitions to success and returns the resolved value', async () => {
    const { result } = renderHook(() => useAsyncAction(() => Promise.resolve('ok')))
    let returned
    await act(async () => {
      returned = await result.current.run()
    })
    expect(result.current.status).toBe('success')
    expect(returned).toBe('ok')
  })

  it('transitions to error and exposes the thrown error', async () => {
    const { result } = renderHook(() => useAsyncAction(() => Promise.reject(new Error('boom'))))
    await act(async () => {
      await expect(result.current.run()).rejects.toThrow('boom')
    })
    expect(result.current.status).toBe('error')
    expect(result.current.error.message).toBe('boom')
  })

  it('reset returns to idle', async () => {
    const { result } = renderHook(() => useAsyncAction(() => Promise.resolve('ok')))
    await act(async () => {
      await result.current.run()
    })
    act(() => {
      result.current.reset()
    })
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
  })
})
