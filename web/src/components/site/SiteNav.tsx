import {useEffect, useState} from 'react'
import {Menu, X} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {api} from '@/lib/api'
import type {SessionUser} from '@/types'

export function SiteNav({
  inGame,
  roomCode,
  onHome,
  onStart,
  onExit,
}: {
  inGame: boolean
  roomCode: string
  onHome: () => void
  onStart: () => void
  onExit: () => void
}) {
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
        <button type="button" className="flex items-center gap-3" onClick={onHome}>
          <span className="grid h-9 w-9 place-items-center rounded-xs bg-brand-near font-display text-lg font-semibold text-white">
            K
          </span>
          <span className="flex flex-col text-left leading-none">
            <span className="font-display text-[20px] tracking-tight">KnowYou</span>
            <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">Know each other, for real.</span>
          </span>
        </button>

        {inGame && (
          <span className="hidden font-mono text-micro uppercase tracking-[0.18em] text-ink-soft sm:block">
            Room {roomCode}
          </span>
        )}

        <div className="hidden items-center gap-5 lg:flex">
          {inGame ? (
            <Button variant="outline" size="sm" onClick={onExit}>
              退出房间
            </Button>
          ) : user ? (
            <>
              <span className="flex items-center gap-2 text-caption text-ink-soft">
                {user.avatar && <img src={user.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />}
                {user.fullname || user.zhihuUid}
              </span>
              <Button size="sm" onClick={onStart}>
                进入剧本间
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
              <Button onClick={onStart}>开始一局</Button>
            </>
          )}
        </div>

        <button type="button" aria-label="打开导航" className="lg:hidden" onClick={() => setOpen((value) => !value)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-ink-hairline bg-white lg:hidden">
          <div className="ky-shell flex flex-col gap-4 py-5">
            {inGame ? (
              <Button variant="outline" className="w-fit" onClick={onExit}>
                退出房间
              </Button>
            ) : (
              <Button
                className="w-fit"
                onClick={() => {
                  setOpen(false)
                  onStart()
                }}
              >
                开始一局
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
