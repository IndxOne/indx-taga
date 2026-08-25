import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import PrimaryButton from '../components/PrimaryButton'
import { ROUTES } from '../navigation/routes'
import { useAppStore } from '../store/useAppStore'

export default function CompleteProfile() {
  const navigate = useNavigate()
  const role = useAppStore((state) => state.role)
  const profile = useAppStore((state) => state.profile)
  const updateProfile = useAppStore((state) => state.updateProfile)
  const [fullName, setFullName] = useState(profile.fullName ?? '')
  const [email, setEmail] = useState(profile.email ?? '')
  const [vehicleModel, setVehicleModel] = useState(profile.vehicleModel ?? '')
  const [vehiclePlate, setVehiclePlate] = useState(profile.vehiclePlate ?? '')
  const [saved, setSaved] = useState(false)

  const isDriver = role === 'driver'
  const isValid = fullName.trim().length >= 2 && email.includes('@') && (!isDriver || (vehicleModel.trim() && vehiclePlate.trim()))

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!isValid) return

    updateProfile({
      fullName: fullName.trim(),
      email: email.trim(),
      ...(isDriver ? { vehicleModel: vehicleModel.trim(), vehiclePlate: vehiclePlate.trim() } : {}),
    })
    setSaved(true)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f4f6fa] px-5 pb-6 pt-6">
      <BackButton to={ROUTES.profile} />

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-taga-green">Votre profil</p>
        <h1 className="mt-2 text-2xl font-bold text-taga-navy">Compléter le profil</h1>
        <p className="mt-2 text-sm leading-5 text-gray-500">Ces informations permettent de sécuriser vos trajets et de personnaliser votre expérience.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="rounded-2xl bg-white p-4 shadow-sm">
          <span className="block text-xs font-semibold text-taga-navy">Nom complet <span className="text-red-500">*</span></span>
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm text-taga-navy outline-none transition focus:border-taga-blue focus:ring-2 focus:ring-taga-blue/10"
            placeholder="Ex. Aurel Dupont"
            required
          />
        </label>

        <label className="rounded-2xl bg-white p-4 shadow-sm">
          <span className="block text-xs font-semibold text-taga-navy">Adresse e-mail <span className="text-red-500">*</span></span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm text-taga-navy outline-none transition focus:border-taga-blue focus:ring-2 focus:ring-taga-blue/10"
            placeholder="vous@exemple.com"
            required
          />
        </label>

        {isDriver && (
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-taga-navy">Véhicule</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label>
                <span className="block text-[11px] text-gray-500">Modèle</span>
                <input
                  value={vehicleModel}
                  onChange={(event) => setVehicleModel(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-taga-blue"
                  placeholder="Toyota Corolla"
                  required
                />
              </label>
              <label>
                <span className="block text-[11px] text-gray-500">Immatriculation</span>
                <input
                  value={vehiclePlate}
                  onChange={(event) => setVehiclePlate(event.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm uppercase outline-none focus:border-taga-blue"
                  placeholder="TAGA-001"
                  required
                />
              </label>
            </div>
          </div>
        )}

        {saved && (
          <div role="status" className="rounded-xl bg-taga-green/10 px-4 py-3 text-sm font-semibold text-taga-green">
            Profil enregistré avec succès.
          </div>
        )}

        <PrimaryButton type="submit" variant="green" disabled={!isValid}>
          {saved ? 'Profil enregistré' : 'Enregistrer mon profil'}
        </PrimaryButton>
        {saved && (
          <button type="button" onClick={() => navigate(ROUTES.profile)} className="py-2 text-sm font-semibold text-taga-blue">
            Retour au profil
          </button>
        )}
      </form>
    </div>
  )
}
