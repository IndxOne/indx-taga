import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { MOCK_RIDE, useAppStore } from '../../store/useAppStore'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  realtime: {
    getActiveRide: vi.fn(),
    getDriverLocation: vi.fn(),
    subscribeToRide: vi.fn(),
  },
}))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mocks.navigate,
}))

vi.mock('../../services/runtimeConfig', () => ({ isDemoMode: false }))
vi.mock('../../services/rideRealtimeService', () => ({
  getDriverLocationRemainingMs: () => 0,
  getRideRealtimeService: () => mocks.realtime,
}))
vi.mock('../../services/dispatchService', () => ({
  getDispatchService: () => ({ requestRideDispatch: vi.fn() }),
}))
vi.mock('../../services/rideService', () => ({
  getRideService: () => ({ cancelRideSearch: vi.fn(), retryRideSearch: vi.fn() }),
}))

import ActiveRide from './ActiveRide'

const searchingRide = {
  id: 'ride-searching',
  passengerId: 'passenger-a',
  driverId: null,
  pickup: { label: 'Cocody', lat: 5.34, lng: -4.01 },
  destination: { label: 'Plateau', lat: 5.32, lng: -4.02 },
  pickupLabel: 'Cocody',
  dropoffLabel: 'Plateau',
  rideType: 'go',
  scheduledAt: null,
  status: 'searching',
  estimatedPrice: null,
  assignedAt: null,
  dispatchDeadlineAt: '2026-09-02T10:02:00.000Z',
  createdAt: '2026-09-02T10:00:00.000Z',
  updatedAt: '2026-09-02T10:00:01.000Z',
}

describe('ActiveRide en mode réel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({ ride: MOCK_RIDE, rideStatus: 'idle' })
    mocks.realtime.getActiveRide.mockResolvedValue(searchingRide)
    mocks.realtime.getDriverLocation.mockResolvedValue(null)
    mocks.realtime.subscribeToRide.mockReturnValue(vi.fn())
  })

  afterEach(() => cleanup())

  it('restaure une course searching après un hard refresh simulé', async () => {
    render(<MemoryRouter><ActiveRide /></MemoryRouter>)

    expect(screen.getByText('Récupération de votre course…')).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Annuler la recherche' })).toBeTruthy())
    await waitFor(() => expect(mocks.realtime.subscribeToRide).toHaveBeenCalledTimes(1))

    expect(mocks.realtime.getActiveRide).toHaveBeenCalledTimes(1)
    expect(mocks.realtime.getDriverLocation).toHaveBeenCalledWith('ride-searching')
    expect(mocks.realtime.subscribeToRide).toHaveBeenCalledWith('ride-searching', expect.objectContaining({
      onRideChange: expect.any(Function),
      onDriverLocationChange: expect.any(Function),
    }))
    expect(useAppStore.getState().ride).toMatchObject({ id: 'ride-searching', status: 'searching' })
  })

  it('redirige vers l’accueil quand Supabase ne renvoie aucune course active', async () => {
    mocks.realtime.getActiveRide.mockResolvedValue(null)

    render(<MemoryRouter><ActiveRide /></MemoryRouter>)

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/client/home', { replace: true }))
    expect(mocks.realtime.subscribeToRide).not.toHaveBeenCalled()
  })

  it('ne montre pas l’annulation pour un statut serveur déjà assigned', async () => {
    mocks.realtime.getActiveRide.mockResolvedValue({ ...searchingRide, status: 'assigned', driverId: 'driver-a' })

    render(<MemoryRouter><ActiveRide /></MemoryRouter>)

    await waitFor(() => expect(mocks.realtime.getDriverLocation).toHaveBeenCalledWith('ride-searching'))
    expect(screen.queryByRole('button', { name: 'Annuler la recherche' })).toBeNull()
  })
})
