import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { REAL_RIDE, useAppStore } from '../store/useAppStore'

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), sendOtp: vi.fn() }))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mocks.navigate,
}))
vi.mock('../services/runtimeConfig', () => ({ isDemoMode: false }))
vi.mock('../services/otpService', () => ({ sendOtp: mocks.sendOtp }))
vi.mock('../services/rideRealtimeService', () => ({
  getRideRealtimeService: () => ({
    subscribeToDriverOffers: () => () => {},
    getActiveDriverRide: () => Promise.resolve(null),
    getActiveDriverOffer: () => Promise.resolve(null),
  }),
}))

import PhoneFrame from '../components/PhoneFrame'
import Onboarding from './Onboarding'
import PaymentMethods from './PaymentMethods'
import RideHistory from './RideHistory'
import Home from './client/Home'
import Estimate from './client/Estimate'
import RideEnd from './client/RideEnd'
import Online from './driver/Online'

const renderScreen = (element) => render(<MemoryRouter>{element}</MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.sendOtp.mockResolvedValue({ challengeId: 'c', phone: '+2250707123456', maskedPhone: '+225 •• 456', expiresIn: 300 })
  useAppStore.setState({ ride: REAL_RIDE, rideStatus: 'idle', role: 'passenger', paymentMethods: [], rideHistory: [] })
})
afterEach(() => cleanup())

describe('mode réel — aucune donnée fictive présentée comme réelle', () => {
  it('n’affiche aucun bandeau démo', () => {
    renderScreen(<PhoneFrame><p>contenu</p></PhoneFrame>)
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('n’applique jamais le numéro de test : l’OTP part vers le numéro saisi', async () => {
    renderScreen(<Onboarding />)
    fireEvent.change(screen.getByLabelText('Numéro de téléphone'), { target: { value: '07 07 12 34 56' } })
    fireEvent.click(screen.getByRole('button', { name: /Recevoir le code SMS/ }))

    await waitFor(() => expect(mocks.sendOtp).toHaveBeenCalledTimes(1))
    const { phone } = mocks.sendOtp.mock.calls[0][0]
    expect(phone).not.toBe('+330775679067')
    expect(phone.startsWith('+225')).toBe(true)
    expect(screen.queryByText(/Mode démo/)).toBeNull()
  })

  it('le bouton reste désactivé tant que le numéro saisi est incomplet', () => {
    renderScreen(<Onboarding />)
    fireEvent.change(screen.getByLabelText('Numéro de téléphone'), { target: { value: '1' } })

    expect(screen.getByRole('button', { name: /Recevoir le code SMS/ }).disabled).toBe(true)
  })

  it('moyens de paiement : aucun compte, solde ni retrait fictif', () => {
    useAppStore.setState({ role: 'driver' })
    renderScreen(<PaymentMethods />)

    expect(screen.getByRole('status').textContent).toMatch(/pas encore activé/)
    expect(screen.queryByText(/SOLDE/)).toBeNull()
    expect(screen.queryByText(/Orange Money|Wave/)).toBeNull()
    expect(screen.queryByText(/Ajouter un moyen/)).toBeNull()
  })

  it('historique : état explicite plutôt que de fausses courses', () => {
    renderScreen(<RideHistory />)

    expect(screen.getByText('Historique indisponible')).toBeTruthy()
    expect(screen.queryByText(/CAISTAB/)).toBeNull()
  })

  it('accueil passager : ni prénom, ni position, ni favoris fictifs', () => {
    renderScreen(<Home />)

    expect(screen.getByText('Bonjour')).toBeTruthy()
    expect(screen.queryByText(/Akissi/)).toBeNull()
    expect(screen.queryByText(/Riviera 3/)).toBeNull()
    expect(screen.queryByLabelText(/Commander une course vers/)).toBeNull()
  })

  it('estimation : ni prix, ni distance, ni durée, ni moyen de paiement fictifs', () => {
    renderScreen(<Estimate />)

    expect(screen.queryByText(/14\.2 km/)).toBeNull()
    expect(screen.queryByText(/\d\s?\d{3}\s?F/)).toBeNull()
    expect(screen.queryByText(/Orange Money/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Demander cette course' })).toBeTruthy()
  })

  it('fin de course passager : aucun paiement, détail tarifaire, chauffeur ou note fictifs', () => {
    useAppStore.setState({ ride: { ...REAL_RIDE, id: 'ride-1' }, rideStatus: 'completed' })
    renderScreen(<RideEnd />)

    expect(screen.getByText('Course terminée')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toMatch(/aucun débit/)
    for (const fake of [/Total payé/, /Orange Money/, /Mamadou/, /TGA-8421/, /Frais de service/, /Reçu PDF/]) {
      expect(screen.queryByText(fake)).toBeNull()
    }
  })

  it('fin de course passager : « Terminer » vide la course locale', () => {
    useAppStore.setState({ ride: { ...REAL_RIDE, id: 'ride-1' }, rideStatus: 'completed' })
    renderScreen(<RideEnd />)

    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }))

    expect(useAppStore.getState().ride.id).toBeNull()
    expect(mocks.navigate).toHaveBeenCalledWith('/client/home')
  })

  it('fin de course passager : affiche le montant seulement s’il vient du serveur', () => {
    useAppStore.setState({ ride: { ...REAL_RIDE, id: 'ride-1', price: 3250 }, rideStatus: 'completed' })
    renderScreen(<RideEnd />)

    expect(screen.getByText(/3.?250/)).toBeTruthy()
  })
})

describe('espace chauffeur — mode réel', () => {
  it('n’affiche ni gains, ni bonus, ni identité fictifs', () => {
    useAppStore.setState({ role: 'driver' })
    // Le suivi des offres n'est pas l'objet de ce test : services neutralisés.
    renderScreen(<Online />)

    expect(screen.queryByText(/TES GAINS/)).toBeNull()
    expect(screen.queryByText(/Yao Aristide/)).toBeNull()
    expect(screen.queryByText(/Bonus \+5/)).toBeNull()
    expect(screen.queryByText(/4\.91/)).toBeNull()
    expect(screen.getByText(/Gains et statistiques disponibles/)).toBeTruthy()
  })
})
