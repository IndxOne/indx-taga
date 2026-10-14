import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { REAL_RIDE, useAppStore } from '../store/useAppStore'

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), sendOtp: vi.fn(), ride: { createRide: vi.fn() } }))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mocks.navigate,
}))
vi.mock('../services/runtimeConfig', () => ({ isDemoMode: false }))
vi.mock('../services/rideService', () => ({ getRideService: () => mocks.ride }))
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

  it.each([
    ['07 07 12 34 56'],
    ['+225 07 07 12 34 56'],
  ])('n’applique jamais le numéro de test : sendOtp reçoit exactement +2250707123456 pour « %s »', async (typed) => {
    renderScreen(<Onboarding />)
    fireEvent.change(screen.getByLabelText('Numéro de téléphone'), { target: { value: typed } })
    fireEvent.click(screen.getByRole('button', { name: /Recevoir le code SMS/ }))

    await waitFor(() => expect(mocks.sendOtp).toHaveBeenCalledTimes(1))
    expect(mocks.sendOtp).toHaveBeenCalledWith({ phone: '+2250707123456', role: 'passenger' })
    expect(screen.queryByText(/Mode démo/)).toBeNull()
  })

  it.each([['1'], ['07 07 12 34 5'], ['07 07 12 34 56 7'], ['07 07 12 34 AB']])(
    'numéro invalide « %s » : bouton désactivé et aucun appel à sendOtp',
    (typed) => {
      renderScreen(<Onboarding />)
      fireEvent.change(screen.getByLabelText('Numéro de téléphone'), { target: { value: typed } })
      const button = screen.getByRole('button', { name: /Recevoir le code SMS/ })

      expect(button.disabled).toBe(true)
      fireEvent.click(button)
      expect(mocks.sendOtp).not.toHaveBeenCalled()
    },
  )

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

  it('accueil passager : ni prénom, ni position, ni favoris fictifs, commande désactivée et expliquée', () => {
    renderScreen(<Home />)

    expect(screen.getByText('Bonjour')).toBeTruthy()
    expect(screen.queryByText(/Akissi/)).toBeNull()
    expect(screen.queryByText(/Riviera 3/)).toBeNull()
    expect(screen.queryByLabelText(/Commander une course vers/)).toBeNull()
    expect(screen.queryByText(/Saisir une destination/)).toBeNull()
    expect(screen.getByRole('status').textContent).toMatch(/commande de course réelle est désactivée/)
  })

  it('état initial réel : départ et destination vides, aucun libellé de démonstration', () => {
    const { ride } = useAppStore.getState()

    expect(ride).toMatchObject({ pickup: null, destination: null, pickupLabel: '', dropoffLabel: '' })
    expect(JSON.stringify(ride)).not.toMatch(/Riviera|CAISTAB|Cocody|Plateau/)
  })

  it('estimation sans point fiable : commande interdite, expliquée, aucune RPC, aucun faux itinéraire', () => {
    renderScreen(<Estimate />)

    const button = screen.getByRole('button', { name: 'Demander cette course' })
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(mocks.ride.createRide).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toMatch(/aucune sélection d’adresse fiable/)

    // Pas de faux trajet : ni libellés, ni distance/durée, ni prix, ni paiement, ni marqueurs SVG.
    for (const fake of [/Riviera/, /CAISTAB/, /14\.2 km/, /\d\s?\d{3}\s?F/, /Orange Money/, /Trajet/]) {
      expect(screen.queryByText(fake)).toBeNull()
    }
    expect(screen.queryByLabelText('Point de prise en charge')).toBeNull()
    expect(screen.queryByLabelText('Destination')).toBeNull()
    expect(screen.getByText(/aucun trajet réel/)).toBeTruthy()
  })

  it.each([
    ['départ sans longitude', { pickup: { label: 'A', lat: 5.3, source: 'device_gps' } }],
    ['destination sans latitude', { destination: { label: 'B', lng: -4, source: 'address_selection' } }],
    ['latitude hors plage', { pickup: { label: 'A', lat: 95, lng: -4, source: 'device_gps' } }],
    ['longitude NaN', { destination: { label: 'B', lat: 5.3, lng: Number.NaN, source: 'address_selection' } }],
    ['provenance non fiable', { pickup: { label: 'A', lat: 5.3, lng: -4, source: 'demo' } }],
    ['libellé seul', { pickup: { label: 'Cocody, Riviera 3' }, destination: { label: 'Plateau, Imm. CAISTAB' } }],
  ])('un point incomplet ou non fiable (%s) laisse la commande désactivée', (_name, patch) => {
    const good = { pickup: { label: 'A', lat: 5.3, lng: -4, source: 'device_gps' }, destination: { label: 'B', lat: 5.2, lng: -4.1, source: 'address_selection' } }
    useAppStore.setState({ ride: { ...REAL_RIDE, ...good, ...patch } })
    renderScreen(<Estimate />)

    expect(screen.getByRole('button', { name: 'Demander cette course' }).disabled).toBe(true)
    expect(mocks.ride.createRide).not.toHaveBeenCalled()
  })

  it('deux points fiables : la commande est possible et ne transmet que ces points', async () => {
    const pickup = { label: 'Ma position', lat: 5.3, lng: -4, source: 'device_gps' }
    const destination = { label: 'Plateau', lat: 5.32, lng: -4.02, source: 'address_selection' }
    useAppStore.setState({ ride: { ...REAL_RIDE, pickup, destination } })
    mocks.ride.createRide.mockResolvedValue({ id: 'ride-1', status: 'requested', estimatedPrice: null, price: null, driverEarning: null })
    renderScreen(<Estimate />)

    expect(screen.getByText('Ma position → Plateau')).toBeTruthy()
    const button = screen.getByRole('button', { name: 'Demander cette course' })
    expect(button.disabled).toBe(false)
    fireEvent.click(button)

    await waitFor(() => expect(mocks.ride.createRide).toHaveBeenCalledTimes(1))
    expect(mocks.ride.createRide).toHaveBeenCalledWith({ pickup, destination, ride_type: 'go' })
    expect(useAppStore.getState().ride).toMatchObject({ id: 'ride-1', price: null, driverEarning: null })
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
