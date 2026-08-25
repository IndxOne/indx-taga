import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import PaymentMethodTile from '../components/PaymentMethodTile'
import PrimaryButton from '../components/PrimaryButton'
import AmountTile from '../components/AmountTile'
import BottomNavBar from '../components/BottomNavBar'
import Icon from '../components/Icon'

export default function PaymentMethods() {
  const role = useAppStore((state) => state.role)
  const paymentMethods = useAppStore((state) => state.paymentMethods)
  const setDefaultPaymentMethod = useAppStore((state) => state.setDefaultPaymentMethod)
  const removePaymentMethod = useAppStore((state) => state.removePaymentMethod)
  const addPaymentMethod = useAppStore((state) => state.addPaymentMethod)
  const driverWalletBalance = useAppStore((state) => state.driverWalletBalance)
  const [showAdd, setShowAdd] = useState(false)

  const isDriver = role === 'driver'
  const title = isDriver ? 'Recevoir mes gains sur' : 'Moyens de paiement'
  const subtitle = isDriver
    ? 'Choisis le compte mobile money sur lequel tes gains sont retirés.'
    : 'Choisis comment tu payes tes courses TAGA.'

  const handleAdd = () => {
    addPaymentMethod({
      id: `pm${Date.now()}`,
      provider: 'wave',
      label: 'Wave',
      maskedNumber: '01 •••• 0000',
      isDefault: false,
    })
    setShowAdd(false)
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 px-6 pt-8 pb-6 overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${isDriver ? 'bg-taga-green/10' : 'bg-taga-blue/10'}`}>
            <Icon name={isDriver ? 'wallet' : 'card'} size={21} />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">{title}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {isDriver && (
          <div className="mt-5 rounded-2xl bg-taga-navy px-4 py-4 text-white">
            <p className="text-xs text-white/50">SOLDE DISPONIBLE</p>
            <AmountTile amount={driverWalletBalance} size="xl" tone="light" />
          </div>
        )}

        <p className="text-xs font-semibold text-gray-400 tracking-wide mt-6 mb-2">
          {isDriver ? 'COMPTES DE RETRAIT' : 'MES MOYENS DE PAIEMENT'}
        </p>
        <div className="flex flex-col gap-3">
          {paymentMethods.map((method) => (
            <PaymentMethodTile
              key={method.id}
              method={method}
              onSetDefault={setDefaultPaymentMethod}
              onRemove={paymentMethods.length > 1 ? removePaymentMethod : undefined}
            />
          ))}
        </div>

        {showAdd ? (
          <div className="mt-4 border border-gray-100 rounded-xl p-4 flex flex-col gap-3">
            <p className="text-sm text-gray-500">Ajouter Wave (démo) ?</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 text-sm font-semibold text-gray-500">
                Annuler
              </button>
              <div className="flex-1">
                <PrimaryButton onClick={handleAdd}>Confirmer</PrimaryButton>
              </div>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setShowAdd(true)} className="mt-4 text-sm font-semibold text-taga-blue text-left">
            + Ajouter un moyen de paiement
          </button>
        )}

        <div className="mt-6 flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-3">
          <Icon name="lock" size={16} className="mt-0.5 shrink-0 text-taga-blue" />
          <p className="text-xs text-gray-500 leading-relaxed">
            {isDriver
              ? 'Tes gains sont crédités automatiquement après chaque course terminée, retrait instantané et sans frais.'
              : 'Tes informations de paiement sont chiffrées. TAGA ne stocke jamais ton code secret mobile money.'}
          </p>
        </div>
      </div>

      <BottomNavBar />
    </div>
  )
}
