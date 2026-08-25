import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PhoneFrame from './components/PhoneFrame'
import SessionGuard from './components/SessionGuard'
import Splash from './screens/Splash'
import RoleChoice from './screens/RoleChoice'
import Onboarding from './screens/Onboarding'
import Otp from './screens/Otp'
import Profile from './screens/Profile'
import CompleteProfile from './screens/CompleteProfile'
import RideHistory from './screens/RideHistory'
import PaymentMethods from './screens/PaymentMethods'
import Home from './screens/client/Home'
import Estimate from './screens/client/Estimate'
import ActiveRide from './screens/client/ActiveRide'
import RideEnd from './screens/client/RideEnd'
import Online from './screens/driver/Online'
import IncomingRequest from './screens/driver/IncomingRequest'
import Navigation from './screens/driver/Navigation'
import RideInProgress from './screens/driver/RideInProgress'
import PayoutRecap from './screens/driver/PayoutRecap'
import { ROUTES } from './navigation/routes'

function App() {
  return (
    <BrowserRouter>
      <PhoneFrame>
        <Routes>
          <Route path={ROUTES.splash} element={<Splash />} />
          <Route path={ROUTES.roleChoice} element={<RoleChoice />} />
          <Route path={ROUTES.onboarding} element={<Onboarding />} />
          <Route path={ROUTES.otp} element={<Otp />} />
          <Route path={ROUTES.profile} element={<SessionGuard><Profile /></SessionGuard>} />
          <Route path={ROUTES.completeProfile} element={<SessionGuard><CompleteProfile /></SessionGuard>} />
          <Route path={ROUTES.rideHistory} element={<SessionGuard><RideHistory /></SessionGuard>} />
          <Route path={ROUTES.paymentMethods} element={<SessionGuard><PaymentMethods /></SessionGuard>} />
          <Route path={ROUTES.clientHome} element={<SessionGuard><Home /></SessionGuard>} />
          <Route path={ROUTES.clientEstimate} element={<SessionGuard><Estimate /></SessionGuard>} />
          <Route path={ROUTES.clientActiveRide} element={<SessionGuard><ActiveRide /></SessionGuard>} />
          <Route path={ROUTES.clientRideEnd} element={<SessionGuard><RideEnd /></SessionGuard>} />
          <Route path={ROUTES.driverOnline} element={<SessionGuard><Online /></SessionGuard>} />
          <Route path={ROUTES.driverIncomingRequest} element={<SessionGuard><IncomingRequest /></SessionGuard>} />
          <Route path={ROUTES.driverNavigation} element={<SessionGuard><Navigation /></SessionGuard>} />
          <Route path={ROUTES.driverRideInProgress} element={<SessionGuard><RideInProgress /></SessionGuard>} />
          <Route path={ROUTES.driverPayoutRecap} element={<SessionGuard><PayoutRecap /></SessionGuard>} />
          <Route path="*" element={<Navigate to={ROUTES.splash} replace />} />
        </Routes>
      </PhoneFrame>
    </BrowserRouter>
  )
}

export default App
