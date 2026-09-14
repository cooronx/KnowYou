import type {ReactNode} from 'react'
import {AnnouncementBar} from './AnnouncementBar'
import {SiteNav} from './SiteNav'

export function SiteLayout({
  children,
  inGame,
  onHome,
  onStart,
  onExit,
}: {
  children: ReactNode
  inGame: boolean
  onHome: () => void
  onStart: () => void
  onExit: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AnnouncementBar />
      <SiteNav inGame={inGame} onHome={onHome} onStart={onStart} onExit={onExit} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
