import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { REAL_RIDE, useAppStore } from '../../store/useAppStore'
import { isRideClosed, resetRideSessionForTests } from '../../services/rideSession'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  realtime: { getCompletedRide: vi.fn() },
}))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mocks.navigate,
}))
vi.mock('../../services/runtimeConfig', () => ({ isDemoMode: false }))
vi.mock('../../services/rideRealtimeService', () => ({ getRideRealtimeService: () => mocks.realtime }))

import RideEnd from './RideEnd'

const completedRide = {
  id: 'ride-1',
  passengerId: 'passenger-1',
  driverId: 'driver-1',
  pickupLabel: 'Ma position',
  dropoffLabel: 'Plateau',
  status: 'completed',
  estimatedPrice: null,
  finalPrice: null,
  driverEarning: null,
  paymentStatus: null,
}

const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/client/ride-end/:rideId" element={<RideEnd />} />
      <Route path="/client/ride-end" element={<RideEnd />} />
    </Routes>
  </MemoryRouter>,
)

beforeEach(() => {
  vi.clearAllMocks()
  resetRideSessionForTests()
  useAppStore.setState({ ride: REAL_RIDE, rideStatus: 'idle' })
})
afterEach(() => cleanup())

describe('RideEnd — récapitulatif réel d’une course terminée', () => {
  it('refresh direct : charge la course de l’URL depuis le serveur, sans dépendre du store', async () => {
    mocks.realtime.getCompletedRide.mockResolvedValue(completedRide)
    renderAt('/client/ride-end/ride-1')

    expect(screen.getByRole('status').textContent).toMatch(/Récupération/)
    expect(await screen.findByText('Course terminée')).toBeTruthy()
    expect(mocks.realtime.getCompletedRide).toHaveBeenCalledWith('ride-1')
    expect(screen.getByText('Ma position → Plateau')).toBeTruthy()
    // Aucune estimation ni prix final : on le dit, sans rien annoncer sur un débit.
    expect(screen.getByText('Montant final non disponible.')).toBeTruthy()
    expect(screen.getByText('Paiement : statut non disponible.')).toBeTruthy()
    expect(screen.queryByText('Estimation indicative')).toBeNull()
    for (const fake of [/Total payé/, /\bPayé\b/, /débit/i, /Orange Money/, /Mamadou/, /TGA-8421/, /Reçu PDF/]) {
      expect(screen.queryByText(fake)).toBeNull()
    }
  })

  it('estimated_price = 3250 sans prix final : « Estimation indicative », jamais un total, un gain ou un paiement', async () => {
    mocks.realtime.getCompletedRide.mockResolvedValue({ ...completedRide, estimatedPrice: 3250 })
    renderAt('/client/ride-end/ride-1')

    expect(await screen.findByText('Estimation indicative')).toBeTruthy()
    expect(screen.getByText(/3.?250/)).toBeTruthy()
    expect(screen.getByText('Montant final non disponible.')).toBeTruthy()
    expect(screen.getByText('Paiement : statut non disponible.')).toBeTruthy()
    expect(screen.queryByText('Montant final')).toBeNull()
    for (const invented of [/2.?763/, /Total payé/, /\bPayé\b/, /Montant de la course/, /débit/i]) {
      expect(document.body.textContent).not.toMatch(invented)
    }
  })

  it('montant final affiché seulement quand un backend autoritatif le fournit', async () => {
    mocks.realtime.getCompletedRide.mockResolvedValue({ ...completedRide, estimatedPrice: 3250, finalPrice: 3400 })
    renderAt('/client/ride-end/ride-1')

    expect(await screen.findByText('Montant final')).toBeTruthy()
    expect(screen.getByText(/3.?400/)).toBeTruthy()
    expect(screen.queryByText('Estimation indicative')).toBeNull()
    expect(screen.queryByText('Montant final non disponible.')).toBeNull()
    expect(screen.getByText('Paiement : statut non disponible.')).toBeTruthy()
  })

  it('course introuvable (absente ou filtrée par la RLS) : état dédié, retour accueil', async () => {
    mocks.realtime.getCompletedRide.mockResolvedValue(null)
    renderAt('/client/ride-end/ride-autre-passager')

    expect((await screen.findByRole('alert')).textContent).toMatch(/introuvable/)
    fireEvent.click(screen.getByRole('button', { name: /Retour à l’accueil/ }))
    expect(mocks.navigate).toHaveBeenCalledWith('/client/home', { replace: true })
  })

  it.each([
    ['code 42501', { code: '42501', message: 'permission denied' }],
    ['statut HTTP 403', { status: 403, message: 'Forbidden' }],
    ['course d’un autre compte', { code: 'forbidden', message: 'autre compte' }],
    ['session absente', { code: 'unauthenticated', message: 'session' }],
  ])('accès interdit (%s) : message explicite, aucune donnée affichée', async (_name, error) => {
    mocks.realtime.getCompletedRide.mockRejectedValue(error)
    renderAt('/client/ride-end/ride-1')

    expect((await screen.findByRole('alert')).textContent).toMatch(/Accès refusé/)
    expect(screen.queryByText('Course terminée')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull()
  })

  it('erreur réseau : message, puis réessai qui réussit', async () => {
    mocks.realtime.getCompletedRide
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce(completedRide)
    renderAt('/client/ride-end/ride-1')

    expect((await screen.findByRole('alert')).textContent).toMatch(/n’a pas pu être chargée/)
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('Course terminée')).toBeTruthy()
    expect(mocks.realtime.getCompletedRide).toHaveBeenCalledTimes(2)
  })

  it('sans identifiant de course : retour à l’accueil, aucune lecture serveur', async () => {
    renderAt('/client/ride-end')

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/client/home', { replace: true }))
    expect(mocks.realtime.getCompletedRide).not.toHaveBeenCalled()
  })

  it('clôture explicite : la course est marquée close, le store vidé, et le récapitulatif ne se rouvre plus', async () => {
    mocks.realtime.getCompletedRide.mockResolvedValue(completedRide)
    useAppStore.setState({ ride: { ...REAL_RIDE, id: 'ride-1' }, rideStatus: 'completed' })
    renderAt('/client/ride-end/ride-1')

    fireEvent.click(await screen.findByRole('button', { name: 'Terminer' }))

    expect(isRideClosed('ride-1')).toBe(true)
    expect(useAppStore.getState().ride.id).toBeNull()
    expect(mocks.navigate).toHaveBeenCalledWith('/client/home', { replace: true })

    cleanup()
    vi.clearAllMocks()
    renderAt('/client/ride-end/ride-1')
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/client/home', { replace: true }))
    expect(mocks.realtime.getCompletedRide).not.toHaveBeenCalled()
  })
})
