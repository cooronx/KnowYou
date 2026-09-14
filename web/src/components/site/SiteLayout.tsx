import type {ReactNode} from 'react'
import {AnnouncementBar} from './AnnouncementBar'
import {SiteNav} from './SiteNav'
import {SiteFooter} from './SiteFooter'

export function SiteLayout({
  children,
  inGame,
  roomCode,
  onHome,
  onStart,
  onExit,
}: {
  children: ReactNode
  inGame: boolean
  roomCode: string
  onHome: () => void
  onStart: () => void
  onExit: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AnnouncementBar />
      <SiteNav inGame={inGame} roomCode={roomCode} onHome={onHome} onStart={onStart} onExit={onExit} />
      <main className="flex-1">{children}</main>
      <SiteFooter onStart={onStart} />
    </div>
  )
}
