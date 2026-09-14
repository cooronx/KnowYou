import {useEffect, useState} from 'react'
import {Link} from 'react-router-dom'
import {Menu, X} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {api} from '@/lib/api'
import type {SessionUser} from '@/types'

const NAV_LINKS = [
  {href: '/#how', label: '怎么玩'},
  {href: '/#room', label: '剧本间'},
  {href: '/#report', label: '认识报告'},
  {href: '/#sources', label: '内容来源'},
]

export function SiteNav() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let active = true
    api
      .session()
      .then((data) => {
        if (active) setUser(data.user)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-ink-hairline bg-white/90 backdrop-blur">
      <div className="ky-shell flex h-20 items-center justify-between gap-6">
        <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <span className="grid h-9 w-9 place-items-center rounded-xs bg-brand-near font-display text-lg font-semibold text-white">
            K
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-[20px] tracking-tight">KnowYou</span>
            <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">Know each other, for real.</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-caption text-ink-soft transition-colors hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          {user ? (
            <>
              <span className="flex items-center gap-2 text-caption text-ink-soft">
                {user.avatar && <img src={user.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />}
                {user.fullname || user.zhihuUid}
              </span>
              <Button asChild variant="outline" size="sm">
                <Link to="/play">进入剧本间</Link>
              </Button>
            </>
          ) : (
            <>
              <a
                href={api.loginUrl}
                className="text-caption text-ink underline decoration-ink-hairline underline-offset-4 hover:decoration-brand-near"
              >
                知乎登录
              </a>
              <Button asChild>
                <Link to="/play">开始一局</Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label="打开导航"
          className="lg:hidden"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-ink-hairline bg-white lg:hidden">
          <div className="ky-shell flex flex-col gap-4 py-5">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-body text-ink-soft"
              >
                {link.label}
              </a>
            ))}
            <Button asChild className="w-fit">
              <Link to="/play" onClick={() => setOpen(false)}>
                开始一局
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}
