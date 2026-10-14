import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { REAL_RIDE, useAppStore } from '../../store/useAppStore'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  realtime: { getActiveDriverRide: vi.fn() },
  dispatch: { advanceRide: vi.fn() },
}))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mocks.navigate,
}))
vi.mock('../../services/runtimeConfig', () => ({ isDemoMode: false }))
vi.mock('../../services/rideRealtimeService', () => ({ getRideRealtimeService: () => mocks.realtime }))
vi.mock('../../services/dispatchService', () => ({ getDispatchService: () => mocks.dispatch }))
vi.mock('../../components/DriverLocationTracker', () => ({ default: () => null }))

import Navigation from './Navigation'
import RideInProgress from './RideInProgress'
import PayoutRecap from './PayoutRecap'

const serverRide = (status, overrides = {}) => ({
  id: 'ride-1',
  passengerId: 'passenger-1',
  driverId: 'driver-1',
  pickup: { label: 'Cocody', lat: 5.34, lng: -4.01 },
  destination: { label: 'Plateau', lat: 5.32, lng: -4.02 },
  pickupLabel: 'Cocody',
  dropoffLabel: 'Plateau',
  rideType: 'go',
  scheduledAt: null,
  status,
  estimatedPrice: null,
  price: null,
  driverEarning: null,
  assignedAt: '2026-09-02T10:00:00.000Z',
  dispatchDeadlineAt: null,
  createdAt: '2026-09-02T09:59:00.000Z',
  updatedAt: '2026-09-02T10:00:00.000Z',
  ...overrides,
})

const renderScreen = (element) => render(<MemoryRouter>{element}</MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  useAppStore.setState({ ride: REAL_RIDE, rideStatus: 'idle', driverAvailable: true })
})
afterEach(() => cleanup())

describe('Navigation chauffeur — mode réel', () => {
  it('restaure la course depuis le serveur et propose la transition suivante', async () => {
    mocks.realtime.getActiveDriverRide.mockResolvedValue(serverRide('arriving'))
    renderScreen(<Navigation />)

    expect(await screen.findByRole('button', { name: 'Je suis arrivé' })).toBeTruthy()
    expect(useAppStore.getState().ride).toMatchObject({ id: 'ride-1', status: 'arriving' })
    expect(useAppStore.getState().rideStatus).toBe('arriving')
  })

  it('le serveur prime sur un statut local périmé du store', async () => {
    useAppStore.setState({ ride: { ...REAL_RIDE, id: 'ride-1', status: 'in_progress' }, rideStatus: 'in_progress' })
    mocks.realtime.getActiveDriverRide.mockResolvedValue(serverRide('assigned'))
    renderScreen(<Navigation />)

    expect(await screen.findByRole('button', { name: 'Je pars vers le passager' })).toBeTruthy()
    expect(useAppStore.getState().rideStatus).toBe('assigned')
  })

  it('n’avance qu’à partir de la réponse serveur', async () => {
    mocks.realtime.getActiveDriverRide.mockResolvedValue(serverRide('assigned'))
    mocks.dispatch.advanceRide.mockResolvedValue(serverRide('arriving'))
    renderScreen(<Navigation />)

    fireEvent.click(await screen.findByRole('button', { name: 'Je pars vers le passager' }))

    await waitFor(() => expect(mocks.dispatch.advanceRide).toHaveBeenCalledWith('ride-1', 'arriving'))
    expect(await screen.findByRole('button', { name: 'Je suis arrivé' })).toBeTruthy()
    expect(useAppStore.getState().rideStatus).toBe('arriving')
  })

  it('démarre la course puis ouvre l’écran en cours uniquement après acceptation serveur', async () => {
    mocks.realtime.getActiveDriverRide.mockResolvedValue(serverRide('arrived'))
    mocks.dispatch.advanceRide.mockResolvedValue(serverRide('in_progress'))
    renderScreen(<Navigation />)

    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer la course' }))

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/driver/ride-in-progress'))
    expect(mocks.dispatch.advanceRide).toHaveBeenCalledWith('ride-1', 'in_progress')
  })

  it('refus serveur : garde l’écran, affiche l’erreur et resynchronise sans avancer', async () => {
    mocks.realtime.getActiveDriverRide.mockResolvedValue(serverRide('assigned'))
    mocks.dispatch.advanceRide.mockRejectedValue(new Error('Transition de course interdite : assigned vers arrived.'))
    renderScreen(<Navigation />)

    fireEvent.click(await screen.findByRole('button', { name: 'Je pars vers le passager' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Transition de course interdite')
    expect(mocks.realtime.getActiveDriverRide).toHaveBeenCalledTimes(2)
    expect(useAppStore.getState().rideStatus).toBe('assigned')
    expect(mocks.navigate).not.toHaveBeenCalledWith('/driver/ride-in-progress')
  })

  it('ignore les doubles clics pendant qu’une transition est en cours', async () => {
    mocks.realtime.getActiveDriverRide.mockResolvedValue(serverRide('assigned'))
    let resolveAdvance
    mocks.dispatch.advanceRide.mockReturnValue(new Promise((resolve) => { resolveAdvance = resolve }))
    renderScreen(<Navigation />)

    const button = await screen.findByRole('button', { name: 'Je pars vers le passager' })
    fireEvent.click(button)
    fireEvent.click(button)
    resolveAdvance(serverRide('arriving'))

    await screen.findByRole('button', { name: 'Je suis arrivé' })
    expect(mocks.dispatch.advanceRide).toHaveBeenCalledTimes(1)
  })

  it('renvoie à l’espace chauffeur quand le serveur ne connaît aucune course active', async () => {
    mocks.realtime.getActiveDriverRide.mockResolvedValue(null)
    renderScreen(<Navigation />)

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/driver/online', { replace: true }))
  })

  it('n’affiche ni passagère, ni note, ni guidage fictifs', async () => {
    mocks.realtime.getActiveDriverRide.mockResolvedValue(serverRide('assigned'))
    renderScreen(<Navigation />)
    await screen.findByRole('button', { name: 'Je pars vers le passager' })

    for (const fake of [/Akissi/, /4\.96/, /200 m/, /Bd Latrille/, /Rue M38/]) {
      expect(screen.queryByText(fake)).toBeNull()
    }
  })
})

describe('Course en cours chauffeur — mode réel', () => {
  it('termine la course via le serveur, libère l’état local et ouvre le récapitulatif', async () => {
    mocks.realtime.getActiveDriverRide.mockResolvedValue(serverRide('in_progress'))
    mocks.dispatch.advanceRide.mockResolvedValue(serverRide('completed'))
    renderScreen(<RideInProgress />)

    fireEvent.click(await screen.findByRole('button', { name: /Terminer la course/ }))

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/driver/payout-recap'))
    expect(mocks.dispatch.advanceRide).toHaveBeenCalledWith('ride-1', 'completed')
    expect(useAppStore.getState().rideStatus).toBe('completed')
    expect(useAppStore.getState().driverAvailable).toBe(false)
    expect(useAppStore.getState().driverWalletBalance).toBeNull()
  })

  it('n’affiche ni ETA, ni vitesse, ni trafic, ni gain fictifs', async () => {
    mocks.realtime.getActiveDriverRide.mockResolvedValue(serverRide('in_progress'))
    renderScreen(<RideInProgress />)
    await screen.findByRole('button', { name: /Terminer la course/ })

    for (const fake of [/~8 min/, /42 km\/h/, /Fluide/, /Akissi/, /1\.4 km/, /2.?720/]) {
      expect(screen.queryByText(fake)).toBeNull()
    }
  })

  it('l’urgence reste honnête : aucun appel d’assistance simulé', async () => {
    mocks.realtime.getActiveDriverRide.mockResolvedValue(serverRide('in_progress'))
    renderScreen(<RideInProgress />)

    fireEvent.click(await screen.findByRole('button', { name: 'Urgence' }))

    expect(screen.getByRole('alert').textContent).toMatch(/n’est pas disponible/)
  })

  it('ne reste pas sur cet écran quand le serveur indique un autre statut', async () => {
    mocks.realtime.getActiveDriverRide.mockResolvedValue(serverRide('arrived'))
    renderScreen(<RideInProgress />)

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/driver/navigation', { replace: true }))
  })
})

describe('Récapitulatif chauffeur — mode réel', () => {
  it('n’affiche ni solde, ni gain, ni retrait fictifs', () => {
    useAppStore.setState({ ride: { ...REAL_RIDE, id: 'ride-1', pickupLabel: 'Cocody', dropoffLabel: 'Plateau' }, rideStatus: 'completed' })
    renderScreen(<PayoutRecap />)

    expect(screen.getByText('Course terminée.')).toBeTruthy()
    expect(screen.queryByText(/SOLDE/)).toBeNull()
    expect(screen.queryByText(/Retirer/)).toBeNull()
    expect(screen.queryByText(/Orange Money/)).toBeNull()
    expect(screen.queryByText(/Bien joué/)).toBeNull()
    expect(screen.queryByText(/5★/)).toBeNull()
    expect(screen.getByRole('status').textContent).toMatch(/pas encore activés/)
  })

  it('« Retour » vide la course locale puis revient à l’espace chauffeur', () => {
    useAppStore.setState({ ride: { ...REAL_RIDE, id: 'ride-1' }, rideStatus: 'completed' })
    renderScreen(<PayoutRecap />)

    fireEvent.click(screen.getByRole('button', { name: /Retour à l’espace chauffeur/ }))

    expect(useAppStore.getState().ride.id).toBeNull()
    expect(mocks.navigate).toHaveBeenCalledWith('/driver/online')
  })
})
