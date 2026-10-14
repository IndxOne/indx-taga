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

function Protected({ children, role }) {
  return <SessionGuard requiredRole={role}>{children}</SessionGuard>
}

function App() {
  return (
    <BrowserRouter>
      <PhoneFrame>
        <Routes>
          <Route path={ROUTES.splash} element={<Splash />} />
          <Route path={ROUTES.roleChoice} element={<RoleChoice />} />
          <Route path={ROUTES.onboarding} element={<Onboarding />} />
          <Route path={ROUTES.otp} element={<Otp />} />
          <Route path={ROUTES.profile} element={<Protected><Profile /></Protected>} />
          <Route path={ROUTES.completeProfile} element={<Protected><CompleteProfile /></Protected>} />
          <Route path={ROUTES.rideHistory} element={<Protected><RideHistory /></Protected>} />
          <Route path={ROUTES.paymentMethods} element={<Protected><PaymentMethods /></Protected>} />
          <Route path={ROUTES.clientHome} element={<Protected role="passenger"><Home /></Protected>} />
          <Route path={ROUTES.clientEstimate} element={<Protected role="passenger"><Estimate /></Protected>} />
          <Route path={ROUTES.clientActiveRide} element={<Protected role="passenger"><ActiveRide /></Protected>} />
          <Route path={ROUTES.clientRideEnd} element={<Protected role="passenger"><RideEnd /></Protected>} />
          <Route path={ROUTES.clientRideEndById} element={<Protected role="passenger"><RideEnd /></Protected>} />
          <Route path={ROUTES.driverOnline} element={<Protected role="driver"><Online /></Protected>} />
          <Route path={ROUTES.driverIncomingRequest} element={<Protected role="driver"><IncomingRequest /></Protected>} />
          <Route path={ROUTES.driverNavigation} element={<Protected role="driver"><Navigation /></Protected>} />
          <Route path={ROUTES.driverRideInProgress} element={<Protected role="driver"><RideInProgress /></Protected>} />
          <Route path={ROUTES.driverPayoutRecap} element={<Protected role="driver"><PayoutRecap /></Protected>} />
          <Route path="*" element={<Navigate to={ROUTES.splash} replace />} />
        </Routes>
      </PhoneFrame>
    </BrowserRouter>
  )
}

export default App
