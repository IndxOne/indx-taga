import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { MOCK_RIDE, useAppStore } from '../store/useAppStore'

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), sendOtp: vi.fn() }))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mocks.navigate,
}))
vi.mock('../services/otpService', () => ({ sendOtp: mocks.sendOtp }))
vi.mock('../components/DriverLocationTracker', () => ({ default: () => null }))

import PhoneFrame from '../components/PhoneFrame'
import Onboarding from './Onboarding'
import Navigation from './driver/Navigation'
import PayoutRecap from './driver/PayoutRecap'
import RideEnd from './client/RideEnd'

const renderScreen = (element) => render(<MemoryRouter>{element}</MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.sendOtp.mockResolvedValue({ challengeId: 'c', phone: '+330775679067', maskedPhone: '+330775679067', expiresIn: 300 })
  useAppStore.setState({ ride: MOCK_RIDE, rideStatus: 'driver_en_route', role: 'passenger' })
})
afterEach(() => cleanup())

describe('mode démonstration (conservé et identifié)', () => {
  it('affiche un bandeau explicite « données fictives »', () => {
    renderScreen(<PhoneFrame><p>contenu</p></PhoneFrame>)

    expect(screen.getByRole('note').textContent).toMatch(/démonstration/i)
    expect(screen.getByRole('note').textContent).toMatch(/fictives/i)
  })

  it('substitue le numéro de test passager en démo locale uniquement', async () => {
    renderScreen(<Onboarding />)
    fireEvent.change(screen.getByLabelText('Numéro de téléphone'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: /Recevoir le code SMS/ }))

    await waitFor(() => expect(mocks.sendOtp).toHaveBeenCalledWith({ phone: '+330775679067', role: 'passenger' }))
    expect(screen.getByText(/Mode démo/)).toBeTruthy()
  })

  it('parcours chauffeur démo inchangé : arrivée locale puis course en cours', () => {
    renderScreen(<Navigation />)

    expect(screen.getByText('Akissi K.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Je suis arrivé · démarrer course/ }))
    expect(useAppStore.getState().rideStatus).toBe('arrived')
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer course' }))
    expect(useAppStore.getState().rideStatus).toBe('in_progress')
    expect(mocks.navigate).toHaveBeenCalledWith('/driver/ride-in-progress')
  })

  it('récapitulatif démo conservé, retrait explicitement simulé', () => {
    renderScreen(<PayoutRecap />)

    expect(screen.getByText(/Bien joué chef/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Retirer/ }))
    expect(screen.getByRole('status').textContent).toMatch(/Retrait simulé \(démo\)/)
  })

  it('fin de course démo conservée', () => {
    renderScreen(<RideEnd />)

    expect(screen.getByText('Arrivé à bon port')).toBeTruthy()
    expect(screen.getByText('Total payé')).toBeTruthy()
  })
})
