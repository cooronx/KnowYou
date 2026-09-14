import {Outlet} from 'react-router-dom'
import {AnnouncementBar} from './AnnouncementBar'
import {SiteNav} from './SiteNav'
import {SiteFooter} from './SiteFooter'

export function SiteLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AnnouncementBar />
      <SiteNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
