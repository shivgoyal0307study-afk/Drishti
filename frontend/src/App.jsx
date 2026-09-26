import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Network from './pages/Network'
import Pilot from './pages/Pilot'
import Trains from './pages/Trains'
import TrainDetail from './pages/TrainDetail'
import Alerts from './pages/Alerts'
import Models from './pages/Models'
import System from './pages/System'
import Simulation from './pages/Simulation'
import AIDecisions from './pages/AIDecisions'
import Inference from './pages/Inference'
import StringChart from './pages/StringChart'
import './index.css'
import './App.css'

function AppLayout() {
  return (
    <>
      <Navbar />
      <div className="page grid-bg">
        <Outlet />
      </div>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing — no navbar */}
        <Route path="/" element={<Home />} />

        {/* App shell — persistent navbar */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard"    element={<Dashboard />} />
          <Route path="/network"      element={<Network />} />
          <Route path="/pilot"        element={<Pilot />} />
          <Route path="/trains"       element={<Trains />} />
          <Route path="/train/:id"    element={<TrainDetail />} />
          <Route path="/string-chart" element={<StringChart />} />
          <Route path="/alerts"       element={<Alerts />} />
          <Route path="/ai"           element={<Models />} />
          <Route path="/inference"    element={<Inference />} />
          <Route path="/system"       element={<System />} />
          <Route path="/simulation"   element={<Simulation />} />
          <Route path="/ai-decisions" element={<AIDecisions />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
