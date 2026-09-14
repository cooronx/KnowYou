import {Navigate, Route, Routes} from 'react-router-dom'
import {SiteLayout} from './components/site/SiteLayout'
import LandingPage from './pages/LandingPage'
import EntryPage from './pages/EntryPage'
import RoomPage from './pages/RoomPage'
import ReportPage from './pages/ReportPage'

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/play" element={<EntryPage />} />
      </Route>
      <Route path="/room/:code" element={<RoomPage />} />
      <Route path="/room/:code/report" element={<ReportPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
