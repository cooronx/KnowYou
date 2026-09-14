import {useCallback, useEffect, useState} from 'react'
import {SiteLayout} from './components/site/SiteLayout'
import LandingPage from './pages/LandingPage'
import EntryPage from './pages/EntryPage'
import RoomPage from './pages/RoomPage'
import ReportPage from './pages/ReportPage'

type View = 'landing' | 'entry' | 'room' | 'report'

const ROOM_KEY = 'roomCode'
const PLAYER_KEY = 'playerId'

const demoParam = new URLSearchParams(window.location.search).get('demo') === '1'

export default function App() {
  const [view, setView] = useState<View>(() => (demoParam || localStorage.getItem(ROOM_KEY) ? 'room' : 'landing'))
  const [roomCode, setRoomCode] = useState(() => (demoParam ? 'DEMO01' : (localStorage.getItem(ROOM_KEY) ?? '')))
  const [playerId, setPlayerId] = useState(() => localStorage.getItem(PLAYER_KEY) ?? '')

  useEffect(() => {
    window.scrollTo({top: 0})
  }, [view])

  const enterRoom = useCallback((code: string, id: string) => {
    localStorage.setItem(ROOM_KEY, code)
    localStorage.setItem(PLAYER_KEY, id)
    setRoomCode(code)
    setPlayerId(id)
    setView('room')
  }, [])

  const clearRoom = useCallback(() => {
    localStorage.removeItem(ROOM_KEY)
    localStorage.removeItem(PLAYER_KEY)
    setPlayerId('')
  }, [])

  const exitRoom = useCallback(() => {
    clearRoom()
    setView('landing')
  }, [clearRoom])

  const inGame = view === 'room' || view === 'report'

  return (
    <SiteLayout
      inGame={inGame}
      roomCode={roomCode}
      onHome={() => setView('landing')}
      onStart={() => setView('entry')}
      onExit={exitRoom}
    >
      {view === 'landing' && <LandingPage onStart={() => setView('entry')} />}
      {view === 'entry' && <EntryPage onEnter={enterRoom} />}
      {view === 'room' && roomCode && (
        <RoomPage code={roomCode} playerId={playerId} onReport={() => setView('report')} />
      )}
      {view === 'report' && roomCode && (
        <ReportPage
          code={roomCode}
          onRestart={() => {
            clearRoom()
            setView('landing')
          }}
        />
      )}
    </SiteLayout>
  )
}
