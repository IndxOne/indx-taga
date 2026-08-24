import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PhoneFrame from './components/PhoneFrame'

function Stub({ name }) {
  return <div className="p-6 text-taga-navy font-semibold">{name} (à venir)</div>
}

function App() {
  return (
    <BrowserRouter>
      <PhoneFrame>
        <Routes>
          <Route path="/" element={<Stub name="Choix de rôle" />} />
          <Route path="/onboarding" element={<Stub name="Onboarding" />} />
          <Route path="/client/home" element={<Stub name="Accueil" />} />
          <Route path="/client/estimate" element={<Stub name="Estimation" />} />
          <Route path="/client/active-ride" element={<Stub name="Course active" />} />
          <Route path="/client/ride-end" element={<Stub name="Fin de course" />} />
          <Route path="/driver/online" element={<Stub name="En ligne" />} />
          <Route path="/driver/incoming-request" element={<Stub name="Demande entrante" />} />
          <Route path="/driver/navigation" element={<Stub name="Navigation" />} />
          <Route path="/driver/ride-in-progress" element={<Stub name="Course en cours" />} />
          <Route path="/driver/payout-recap" element={<Stub name="Récap & retrait" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PhoneFrame>
    </BrowserRouter>
  )
}

export default App
