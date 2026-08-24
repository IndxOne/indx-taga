import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PhoneFrame from './components/PhoneFrame'
import RoleChoice from './screens/RoleChoice'
import Onboarding from './screens/Onboarding'
import Home from './screens/client/Home'
import Estimate from './screens/client/Estimate'
import ActiveRide from './screens/client/ActiveRide'
import RideEnd from './screens/client/RideEnd'

function Stub({ name }) {
  return <div className="p-6 text-taga-navy font-semibold">{name} (à venir)</div>
}

function App() {
  return (
    <BrowserRouter>
      <PhoneFrame>
        <Routes>
          <Route path="/" element={<RoleChoice />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/client/home" element={<Home />} />
          <Route path="/client/estimate" element={<Estimate />} />
          <Route path="/client/active-ride" element={<ActiveRide />} />
          <Route path="/client/ride-end" element={<RideEnd />} />
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
