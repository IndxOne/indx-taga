import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useAsyncData } from './useAsyncData'

describe('useAsyncData', () => {
  it('starts loading then resolves to success', async () => {
    const loader = () => Promise.resolve([1, 2, 3])
    const { result } = renderHook(() => useAsyncData(loader))
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toEqual([1, 2, 3])
  })

  it('resolves to empty when isEmpty matches the data', async () => {
    const loader = () => Promise.resolve([])
    const { result } = renderHook(() =>
      useAsyncData(loader, { isEmpty: (data) => data.length === 0 }),
    )
    await waitFor(() => expect(result.current.status).toBe('empty'))
  })

  it('resolves to error on a network-kind rejection', async () => {
    const err = Object.assign(new Error('net down'), { kind: 'network' })
    const loader = () => Promise.reject(err)
    const { result } = renderHook(() => useAsyncData(loader))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error.message).toBe('net down')
  })

  it('resolves to unavailable on an unavailable-kind rejection', async () => {
    const err = Object.assign(new Error('service down'), { kind: 'unavailable' })
    const loader = () => Promise.reject(err)
    const { result } = renderHook(() => useAsyncData(loader))
    await waitFor(() => expect(result.current.status).toBe('unavailable'))
  })

  it('retry re-runs the loader', async () => {
    const loader = vi.fn().mockResolvedValue('ok')
    const { result } = renderHook(() => useAsyncData(loader))
    await waitFor(() => expect(result.current.status).toBe('success'))
    await act(async () => {
      result.current.retry()
    })
    expect(loader).toHaveBeenCalledTimes(2)
  })
})
