import {Route, Routes} from 'react-router-dom'
import HomePage from './pages/HomePage'
import ReportPage from './pages/ReportPage'
import RoomPage from './pages/RoomPage'

export default function App() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl px-4 py-10">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:code" element={<RoomPage />} />
        <Route path="/room/:code/report" element={<ReportPage />} />
      </Routes>
    </div>
  )
}
