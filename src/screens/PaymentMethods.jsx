import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import PaymentMethodTile from '../components/PaymentMethodTile'
import PrimaryButton from '../components/PrimaryButton'
import BottomNavBar from '../components/BottomNavBar'

export default function PaymentMethods() {
  const role = useAppStore((state) => state.role)
  const paymentMethods = useAppStore((state) => state.paymentMethods)
  const setDefaultPaymentMethod = useAppStore((state) => state.setDefaultPaymentMethod)
  const removePaymentMethod = useAppStore((state) => state.removePaymentMethod)
  const addPaymentMethod = useAppStore((state) => state.addPaymentMethod)
  const [showAdd, setShowAdd] = useState(false)

  const title = role === 'driver' ? 'Recevoir mes gains sur' : 'Moyens de paiement'

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
      <div className="flex-1 px-6 pt-8 pb-6">
        <h1 className="text-xl font-bold">{title}</h1>

        <div className="flex flex-col gap-3 mt-5">
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
      </div>

      <BottomNavBar />
    </div>
  )
}
