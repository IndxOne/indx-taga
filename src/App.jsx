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

function App() {
  return (
    <BrowserRouter>
      <PhoneFrame>
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/role-choice" element={<RoleChoice />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/otp" element={<Otp />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/ride-history" element={<RideHistory />} />
          <Route path="/payment-methods" element={<PaymentMethods />} />
          <Route path="/client/home" element={<Home />} />
          <Route path="/client/estimate" element={<Estimate />} />
          <Route path="/client/active-ride" element={<ActiveRide />} />
          <Route path="/client/ride-end" element={<RideEnd />} />
          <Route path="/driver/online" element={<Online />} />
          <Route path="/driver/incoming-request" element={<IncomingRequest />} />
          <Route path="/driver/navigation" element={<Navigation />} />
          <Route path="/driver/ride-in-progress" element={<RideInProgress />} />
          <Route path="/driver/payout-recap" element={<PayoutRecap />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PhoneFrame>
    </BrowserRouter>
  )
}

export default App
