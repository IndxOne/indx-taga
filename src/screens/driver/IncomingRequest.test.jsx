import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  realtime: {
    getActiveDriverOffer: vi.fn(),
    subscribeToDriverOffers: vi.fn(),
  },
  dispatch: {
    respondToOffer: vi.fn(),
    expireOffer: vi.fn(),
  },
}))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mocks.navigate,
}))

vi.mock('../../services/runtimeConfig', () => ({ isDemoMode: false }))
vi.mock('../../services/rideRealtimeService', () => ({
  getRideRealtimeService: () => mocks.realtime,
}))
vi.mock('../../services/dispatchService', () => ({
  getDispatchService: () => mocks.dispatch,
}))

import IncomingRequest from './IncomingRequest'

const offer = {
  id: 'offer-1',
  rideId: 'ride-1',
  driverId: 'driver-1',
  status: 'offered',
  offeredAt: '2026-09-02T10:00:00.000Z',
  expiresAt: new Date(Date.now() + 30_000).toISOString(),
  ride: {
    id: 'ride-1',
    passengerId: 'passenger-1',
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
    dispatchDeadlineAt: null,
    createdAt: '2026-09-02T09:59:00.000Z',
    updatedAt: '2026-09-02T10:00:00.000Z',
  },
}

describe('IncomingRequest chauffeur en mode réel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({ ride: {}, rideStatus: 'idle' })
    mocks.realtime.getActiveDriverOffer.mockResolvedValue(offer)
    mocks.realtime.subscribeToDriverOffers.mockReturnValue(vi.fn())
    mocks.dispatch.expireOffer.mockResolvedValue({ id: 'ride-1', status: 'no_driver' })
  })

  afterEach(() => cleanup())

  it('charge et affiche l’offre courante du chauffeur', async () => {
    render(<MemoryRouter><IncomingRequest /></MemoryRouter>)

    await waitFor(() => expect(screen.getAllByText('Plateau').length).toBeGreaterThan(0))
    expect(mocks.realtime.getActiveDriverOffer).toHaveBeenCalledTimes(1)
    // Prix non fixé par le serveur : aucun montant de repli affiché.
    expect(screen.queryByText(/2.?720 F/)).toBeNull()
    expect(screen.queryByText(/3.?200 F/)).toBeNull()
    expect(screen.getAllByText('Montant à confirmer').length).toBeGreaterThan(0)
    expect(mocks.realtime.subscribeToDriverOffers).toHaveBeenCalledWith(expect.objectContaining({
      onOfferChange: expect.any(Function),
      onError: expect.any(Function),
    }))
  })

  it('répond une seule fois à un double clic puis ouvre la navigation', async () => {
    let resolveResponse
    const responseRide = { ...offer.ride, status: 'assigned', driverId: 'driver-1', assignedAt: '2026-09-02T10:00:05.000Z' }
    mocks.dispatch.respondToOffer.mockReturnValue(new Promise((resolve) => { resolveResponse = resolve }))

    render(<MemoryRouter><IncomingRequest /></MemoryRouter>)
    await waitFor(() => expect(screen.getByRole('button', { name: /Accepter/ })).toBeTruthy())

    const acceptButton = screen.getByRole('button', { name: /Accepter/ })
    fireEvent.click(acceptButton)
    fireEvent.click(acceptButton)

    expect(mocks.dispatch.respondToOffer).toHaveBeenCalledTimes(1)
    expect(mocks.dispatch.respondToOffer).toHaveBeenCalledWith('offer-1', 'accept')
    expect(screen.getByRole('button', { name: 'Acceptation…' })).toBeTruthy()

    resolveResponse(responseRide)
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/driver/navigation', { replace: true }))
    expect(useAppStore.getState().ride).toMatchObject({ id: 'ride-1', status: 'assigned', driverId: 'driver-1' })
  })
})
