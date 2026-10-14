import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadStore(isDemoMode) {
  vi.resetModules()
  vi.doMock('../services/runtimeConfig', () => ({ isDemoMode }))
  return import('./useAppStore')
}

afterEach(() => {
  vi.doUnmock('../services/runtimeConfig')
  vi.resetModules()
})

describe('store — séparation démo / réel', () => {
  it('mode réel : aucune donnée fictive de revenus, paiement, profil ou chauffeur', async () => {
    const { useAppStore } = await loadStore(false)
    const state = useAppStore.getState()

    expect(state.driverEarningsToday).toBeNull()
    expect(state.driverRidesToday).toBeNull()
    expect(state.driverHoursOnline).toBeNull()
    expect(state.driverWalletBalance).toBeNull()
    expect(state.paymentMethods).toEqual([])
    expect(state.rideHistory).toEqual([])
    expect(state.driver).toBeNull()
    expect(state.profile.fullName).toBe('')
    expect(state.profile.hasDriverProfile).toBe(false)
  })

  it('mode réel : la course initiale n’a ni prix, ni distance, ni durée fictifs', async () => {
    const { useAppStore } = await loadStore(false)
    const { ride } = useAppStore.getState()

    expect(ride).toMatchObject({ id: null, estimatedPrice: null, finalPrice: null, driverEarning: null, paymentStatus: null, distanceKm: null, durationMin: null })
    expect(ride).not.toHaveProperty('price')
  })

  it('mode réel : resetRide et logout vident la course du compte précédent', async () => {
    const { useAppStore, REAL_RIDE } = await loadStore(false)
    useAppStore.setState({ ride: { ...REAL_RIDE, id: 'ride-1', estimatedPrice: 3200 }, rideStatus: 'completed' })

    useAppStore.getState().resetRide()
    expect(useAppStore.getState().ride.id).toBeNull()
    expect(useAppStore.getState().rideStatus).toBe('idle')

    useAppStore.setState({ ride: { ...REAL_RIDE, id: 'ride-2' }, rideStatus: 'in_progress' })
    useAppStore.getState().logout()
    expect(useAppStore.getState().ride.id).toBeNull()
    expect(useAppStore.getState().rideStatus).toBe('idle')
  })

  it('mode démo : conserve les données de démonstration existantes', async () => {
    const { useAppStore, MOCK_RIDE } = await loadStore(true)
    const state = useAppStore.getState()

    expect(state.ride).toBe(MOCK_RIDE)
    expect(state.driverWalletBalance).toBe(25120)
    expect(state.driverEarningsToday).toBe(22400)
    expect(state.paymentMethods).toHaveLength(2)
    expect(state.driver.name).toBe('Mamadou Ndour')
  })
})
