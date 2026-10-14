import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { REAL_RIDE, useAppStore } from '../../store/useAppStore'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  realtime: {
    subscribeToDriverOffers: vi.fn(),
    getActiveDriverRide: vi.fn(),
    getActiveDriverOffer: vi.fn(),
  },
  dispatch: { getDriverAvailability: vi.fn(), setDriverAvailability: vi.fn() },
}))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mocks.navigate,
}))
vi.mock('../../services/runtimeConfig', () => ({ isDemoMode: false }))
vi.mock('../../services/rideRealtimeService', () => ({ getRideRealtimeService: () => mocks.realtime }))
vi.mock('../../services/dispatchService', () => ({ getDispatchService: () => mocks.dispatch }))

import Online from './Online'

const availability = (status) => ({
  userId: 'driver-1',
  availabilityStatus: status,
  available: status === 'available',
  availableSince: null,
  updatedAt: null,
})

const renderOnline = () => render(<MemoryRouter><Online /></MemoryRouter>)
const toggle = () => screen.getByRole('checkbox', { name: /Disponible pour course/ })

beforeEach(() => {
  vi.clearAllMocks()
  useAppStore.setState({ ride: REAL_RIDE, driverAvailable: false, role: 'driver' })
  mocks.realtime.subscribeToDriverOffers.mockReturnValue(vi.fn())
  mocks.realtime.getActiveDriverRide.mockResolvedValue(null)
  mocks.realtime.getActiveDriverOffer.mockResolvedValue(null)
})
afterEach(() => cleanup())

describe('Online chauffeur — disponibilité lue sur le serveur', () => {
  it('n’affiche pas « HORS LIGNE » tant que la lecture serveur n’est pas terminée', async () => {
    let resolveRead
    mocks.dispatch.getDriverAvailability.mockReturnValue(new Promise((resolve) => { resolveRead = resolve }))
    renderOnline()

    expect(screen.getByText(/SYNCHRONISATION/)).toBeTruthy()
    expect(screen.queryByText('HORS LIGNE')).toBeNull()
    expect(screen.queryByText('EN LIGNE')).toBeNull()
    expect(toggle().disabled).toBe(true)

    await act(async () => resolveRead(availability('offline')))
    expect(await screen.findByText('HORS LIGNE')).toBeTruthy()
    expect(toggle().disabled).toBe(false)
  })

  it('restaure « en ligne » après rechargement alors que le store repart à faux', async () => {
    mocks.dispatch.getDriverAvailability.mockResolvedValue(availability('available'))
    renderOnline()

    expect(await screen.findByText('EN LIGNE')).toBeTruthy()
    expect(toggle().checked).toBe(true)
    expect(useAppStore.getState().driverAvailable).toBe(true)
  })

  it('après clôture de course le serveur dit hors ligne : l’UI et le store suivent le serveur', async () => {
    useAppStore.setState({ driverAvailable: true })
    mocks.dispatch.getDriverAvailability.mockResolvedValue(availability('offline'))
    renderOnline()

    expect(await screen.findByText('HORS LIGNE')).toBeTruthy()
    expect(toggle().checked).toBe(false)
    expect(useAppStore.getState().driverAvailable).toBe(false)
  })

  it('en course : « EN COURSE », bascule verrouillée, aucune écriture', async () => {
    mocks.dispatch.getDriverAvailability.mockResolvedValue(availability('on_ride'))
    renderOnline()

    expect(await screen.findByText('EN COURSE')).toBeTruthy()
    expect(toggle().disabled).toBe(true)
    fireEvent.click(toggle())
    expect(mocks.dispatch.setDriverAvailability).not.toHaveBeenCalled()
    expect(screen.getByText(/verrouillée par le serveur/)).toBeTruthy()
  })

  it('lecture en échec : état inconnu (jamais « hors ligne »), bascule bloquée, relecture possible', async () => {
    mocks.dispatch.getDriverAvailability
      .mockRejectedValueOnce(new Error('Réseau indisponible'))
      .mockResolvedValueOnce(availability('available'))
    renderOnline()

    expect(await screen.findByText('ÉTAT INCONNU')).toBeTruthy()
    expect(screen.queryByText('HORS LIGNE')).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('Réseau indisponible')
    expect(toggle().disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Relire ma disponibilité' }))
    expect(await screen.findByText('EN LIGNE')).toBeTruthy()
    expect(mocks.dispatch.getDriverAvailability).toHaveBeenCalledTimes(2)
  })

  it('bloque les bascules concurrentes pendant la synchronisation', async () => {
    mocks.dispatch.getDriverAvailability.mockResolvedValue(availability('offline'))
    let resolveSet
    mocks.dispatch.setDriverAvailability.mockReturnValue(new Promise((resolve) => { resolveSet = resolve }))
    renderOnline()
    await screen.findByText('HORS LIGNE')

    fireEvent.click(toggle())
    fireEvent.click(toggle())
    fireEvent.click(toggle())
    expect(mocks.dispatch.setDriverAvailability).toHaveBeenCalledTimes(1)
    expect(mocks.dispatch.setDriverAvailability).toHaveBeenCalledWith(true)
    expect(toggle().disabled).toBe(true)

    await act(async () => resolveSet(availability('available')))
    expect(await screen.findByText('EN LIGNE')).toBeTruthy()
    expect(toggle().disabled).toBe(false)

    // Une fois la synchronisation terminée, une nouvelle bascule est de nouveau possible.
    mocks.dispatch.setDriverAvailability.mockResolvedValue(availability('offline'))
    fireEvent.click(toggle())
    await waitFor(() => expect(mocks.dispatch.setDriverAvailability).toHaveBeenCalledTimes(2))
    expect(mocks.dispatch.setDriverAvailability).toHaveBeenLastCalledWith(false)
  })

  it('refus serveur : le statut affiché reste celui du serveur et l’erreur est visible', async () => {
    mocks.dispatch.getDriverAvailability.mockResolvedValue(availability('offline'))
    mocks.dispatch.setDriverAvailability.mockRejectedValue(new Error('Un véhicule actif est nécessaire pour passer en ligne.'))
    renderOnline()
    await screen.findByText('HORS LIGNE')

    fireEvent.click(toggle())

    expect((await screen.findByRole('alert')).textContent).toContain('véhicule actif')
    expect(screen.getByText('HORS LIGNE')).toBeTruthy()
    expect(toggle().checked).toBe(false)
  })

  it('une course en cours côté serveur redirige vers son écran (reprise)', async () => {
    mocks.dispatch.getDriverAvailability.mockResolvedValue(availability('on_ride'))
    mocks.realtime.getActiveDriverRide.mockResolvedValue({ id: 'ride-1', status: 'arrived' })
    renderOnline()

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/driver/navigation', { replace: true }))
  })
})
