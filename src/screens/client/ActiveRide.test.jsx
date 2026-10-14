import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { MOCK_RIDE, useAppStore } from '../../store/useAppStore'
import { markRideClosed, recallRide, rememberRide, resetRideSessionForTests } from '../../services/rideSession'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  realtime: {
    getActiveRide: vi.fn(),
    getCompletedRide: vi.fn(),
    getRide: vi.fn(),
    getDriverLocation: vi.fn(),
    subscribeToRide: vi.fn(),
  },
  dispatch: {
    requestRideDispatch: vi.fn(),
  },
  ride: {
    cancelRideSearch: vi.fn(),
    retryRideSearch: vi.fn(),
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
  getDispatchService: () => mocks.dispatch,
}))
vi.mock('../../services/rideService', () => ({
  getRideService: () => mocks.ride,
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
    resetRideSessionForTests()
    useAppStore.setState({ ride: MOCK_RIDE, rideStatus: 'idle' })
    mocks.realtime.getActiveRide.mockResolvedValue(searchingRide)
    mocks.realtime.getDriverLocation.mockResolvedValue(null)
    mocks.realtime.subscribeToRide.mockReturnValue(vi.fn())
    mocks.dispatch.requestRideDispatch.mockReset()
    mocks.ride.cancelRideSearch.mockReset()
    mocks.ride.retryRideSearch.mockReset()
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

  it('suit la progression décidée par le chauffeur sans ETA ni chauffeur fictif, puis ouvre la fin de course', async () => {
    mocks.realtime.getActiveRide.mockResolvedValue({ ...searchingRide, status: 'assigned', driverId: 'driver-1', dispatchDeadlineAt: null })

    render(<MemoryRouter><ActiveRide /></MemoryRouter>)
    await waitFor(() => expect(mocks.realtime.subscribeToRide).toHaveBeenCalledTimes(1))
    const { onRideChange } = mocks.realtime.subscribeToRide.mock.calls[0][1]

    act(() => onRideChange({ ...searchingRide, status: 'arriving', driverId: 'driver-1', dispatchDeadlineAt: null }))
    await waitFor(() => expect(screen.getByText('Votre chauffeur est en approche.')).toBeTruthy())
    for (const fake of [/Mamadou/, /3 min/, /Rue M38/]) {
      expect(screen.queryByText(fake)).toBeNull()
    }
    expect(mocks.navigate).not.toHaveBeenCalledWith(expect.stringContaining('/client/ride-end'), expect.anything())

    act(() => onRideChange({ ...searchingRide, status: 'completed', driverId: 'driver-1', dispatchDeadlineAt: null }))
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/client/ride-end/ride-searching', { replace: true }))
    expect(useAppStore.getState().ride).toMatchObject({ id: 'ride-searching', status: 'completed' })
  })

  it('course terminée dont l’événement Realtime a été manqué : restaurée après un rechargement', async () => {
    rememberRide('ride-searching')
    mocks.realtime.getActiveRide.mockResolvedValue(null)
    mocks.realtime.getCompletedRide.mockResolvedValue({ ...searchingRide, status: 'completed', driverId: 'driver-1' })

    render(<MemoryRouter><ActiveRide /></MemoryRouter>)

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/client/ride-end/ride-searching', { replace: true }))
    expect(mocks.realtime.getCompletedRide).toHaveBeenCalledWith('ride-searching')
    expect(mocks.navigate).not.toHaveBeenCalledWith('/client/home', expect.anything())
  })

  it('course mémorisée mais non terminée côté serveur : oubliée, retour à l’accueil', async () => {
    rememberRide('ride-searching')
    mocks.realtime.getActiveRide.mockResolvedValue(null)
    mocks.realtime.getCompletedRide.mockResolvedValue(null)

    render(<MemoryRouter><ActiveRide /></MemoryRouter>)

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/client/home', { replace: true }))
    expect(recallRide()).toBeNull()
  })

  it('récapitulatif déjà clôturé : jamais rouvert, aucune lecture serveur', async () => {
    rememberRide('ride-searching')
    markRideClosed('ride-searching')
    mocks.realtime.getActiveRide.mockResolvedValue(null)

    render(<MemoryRouter><ActiveRide /></MemoryRouter>)

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/client/home', { replace: true }))
    expect(mocks.realtime.getCompletedRide).not.toHaveBeenCalled()
    expect(mocks.navigate).not.toHaveBeenCalledWith(expect.stringContaining('/client/ride-end'), expect.anything())
  })

  it('erreur réseau pendant la restauration : message d’erreur, pas de redirection trompeuse', async () => {
    rememberRide('ride-searching')
    mocks.realtime.getActiveRide.mockResolvedValue(null)
    mocks.realtime.getCompletedRide.mockRejectedValue(new Error('Réseau indisponible'))

    render(<MemoryRouter><ActiveRide /></MemoryRouter>)

    expect((await screen.findByRole('alert')).textContent).toContain('Réseau indisponible')
    expect(mocks.navigate).not.toHaveBeenCalled()
    expect(recallRide()).toBe('ride-searching')
  })

  it('reconnexion réseau : un événement de fin manqué est rattrapé par une relecture serveur', async () => {
    mocks.realtime.getActiveRide.mockResolvedValue({ ...searchingRide, status: 'in_progress', driverId: 'driver-1', dispatchDeadlineAt: null })
    mocks.realtime.getRide.mockResolvedValue({ ...searchingRide, status: 'completed', driverId: 'driver-1', dispatchDeadlineAt: null })

    render(<MemoryRouter><ActiveRide /></MemoryRouter>)
    await waitFor(() => expect(mocks.realtime.subscribeToRide).toHaveBeenCalledTimes(1))

    act(() => { window.dispatchEvent(new Event('online')) })

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/client/ride-end/ride-searching', { replace: true }))
    expect(mocks.realtime.getRide).toHaveBeenCalledWith('ride-searching')
  })

  it('canal Realtime en erreur : relecture serveur de la course', async () => {
    mocks.realtime.getActiveRide.mockResolvedValue({ ...searchingRide, status: 'in_progress', driverId: 'driver-1', dispatchDeadlineAt: null })
    mocks.realtime.getRide.mockResolvedValue({ ...searchingRide, status: 'completed', driverId: 'driver-1', dispatchDeadlineAt: null })

    render(<MemoryRouter><ActiveRide /></MemoryRouter>)
    await waitFor(() => expect(mocks.realtime.subscribeToRide).toHaveBeenCalledTimes(1))
    const { onError } = mocks.realtime.subscribeToRide.mock.calls[0][1]

    act(() => onError(new Error('Canal fermé')))

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/client/ride-end/ride-searching', { replace: true }))
  })

  it('redirige vers l’accueil quand Supabase ne renvoie aucune course active', async () => {
    mocks.realtime.getActiveRide.mockResolvedValue(null)

    render(<MemoryRouter><ActiveRide /></MemoryRouter>)

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/client/home', { replace: true }))
    expect(mocks.realtime.subscribeToRide).not.toHaveBeenCalled()
  })

  it('ne lance le dispatch initial qu’une seule fois sous StrictMode', async () => {
    const requestedRide = { ...searchingRide, status: 'requested', dispatchDeadlineAt: null }
    const dispatchedRide = { ...searchingRide, dispatchDeadlineAt: new Date(Date.now() + 120_000).toISOString() }
    mocks.realtime.getActiveRide.mockResolvedValue(requestedRide)
    mocks.dispatch.requestRideDispatch.mockResolvedValue(dispatchedRide)

    render(<StrictMode><MemoryRouter><ActiveRide /></MemoryRouter></StrictMode>)

    await waitFor(() => expect(mocks.dispatch.requestRideDispatch).toHaveBeenCalledWith('ride-searching'))
    expect(mocks.dispatch.requestRideDispatch).toHaveBeenCalledTimes(1)
  })

  it('ne montre pas l’annulation pour un statut serveur déjà assigned', async () => {
    mocks.realtime.getActiveRide.mockResolvedValue({ ...searchingRide, status: 'assigned', driverId: 'driver-a' })

    render(<MemoryRouter><ActiveRide /></MemoryRouter>)

    await waitFor(() => expect(mocks.realtime.getDriverLocation).toHaveBeenCalledWith('ride-searching'))
    expect(screen.queryByRole('button', { name: 'Annuler la recherche' })).toBeNull()
  })

  it('relance la recherche et appelle le dispatch une seule fois malgré un double clic', async () => {
    let resolveReset
    const resetRide = { ...searchingRide, status: 'requested', dispatchDeadlineAt: null }
    const dispatchedRide = { ...searchingRide, dispatchDeadlineAt: new Date(Date.now() + 120_000).toISOString() }
    mocks.realtime.getActiveRide.mockResolvedValue({ ...searchingRide, status: 'no_driver', dispatchDeadlineAt: null })
    mocks.ride.retryRideSearch.mockReturnValue(new Promise((resolve) => { resolveReset = resolve }))
    mocks.dispatch.requestRideDispatch.mockResolvedValue(dispatchedRide)

    render(<MemoryRouter><ActiveRide /></MemoryRouter>)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy())

    const retryButton = screen.getByRole('button', { name: 'Réessayer' })
    fireEvent.click(retryButton)
    fireEvent.click(retryButton)

    expect(mocks.ride.retryRideSearch).toHaveBeenCalledTimes(1)
    expect(useAppStore.getState().ride).toMatchObject({ id: 'ride-searching', status: 'searching' })
    expect(screen.getByRole('button', { name: 'Relance en cours…' })).toBeTruthy()

    resolveReset(resetRide)
    await waitFor(() => expect(mocks.dispatch.requestRideDispatch).toHaveBeenCalledWith('ride-searching'))
    expect(mocks.dispatch.requestRideDispatch).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(useAppStore.getState().ride).toMatchObject({ id: 'ride-searching', status: 'searching' }))
  })

  it('affiche l’erreur backend et conserve un statut honnête si le dispatch échoue', async () => {
    const resetRide = { ...searchingRide, status: 'requested', dispatchDeadlineAt: null }
    mocks.realtime.getActiveRide.mockResolvedValue({ ...searchingRide, status: 'no_driver', dispatchDeadlineAt: null })
    mocks.ride.retryRideSearch.mockResolvedValue(resetRide)
    mocks.dispatch.requestRideDispatch.mockRejectedValue(new Error('Service de dispatch indisponible.'))

    render(<MemoryRouter><ActiveRide /></MemoryRouter>)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Service de dispatch indisponible.'))
    expect(useAppStore.getState().ride).toMatchObject({ id: 'ride-searching', status: 'requested' })
  })
})
