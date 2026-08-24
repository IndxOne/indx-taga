import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PhoneFrame from './components/PhoneFrame'
import Splash from './screens/Splash'
import RoleChoice from './screens/RoleChoice'
import Onboarding from './screens/Onboarding'
import Otp from './screens/Otp'
import Profile from './screens/Profile'
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
          <Route path={ROUTES.profile} element={<Profile />} />
          <Route path={ROUTES.rideHistory} element={<RideHistory />} />
          <Route path={ROUTES.paymentMethods} element={<PaymentMethods />} />
          <Route path={ROUTES.clientHome} element={<Home />} />
          <Route path={ROUTES.clientEstimate} element={<Estimate />} />
          <Route path={ROUTES.clientActiveRide} element={<ActiveRide />} />
          <Route path={ROUTES.clientRideEnd} element={<RideEnd />} />
          <Route path={ROUTES.driverOnline} element={<Online />} />
          <Route path={ROUTES.driverIncomingRequest} element={<IncomingRequest />} />
          <Route path={ROUTES.driverNavigation} element={<Navigation />} />
          <Route path={ROUTES.driverRideInProgress} element={<RideInProgress />} />
          <Route path={ROUTES.driverPayoutRecap} element={<PayoutRecap />} />
          <Route path="*" element={<Navigate to={ROUTES.splash} replace />} />
        </Routes>
      </PhoneFrame>
    </BrowserRouter>
  )
}

export default App
