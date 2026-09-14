import type {ReactNode} from 'react'
import {Link} from 'react-router-dom'

export function AppShell({meta, children}: {meta?: string; children: ReactNode}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-ink-hairline bg-white/90 backdrop-blur">
        <div className="ky-shell flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-xs bg-brand-near font-display text-base font-semibold text-white">
              K
            </span>
            <span className="font-display text-[18px] tracking-tight">KnowYou</span>
          </Link>
          {meta && <span className="hidden font-mono text-micro uppercase tracking-[0.18em] text-ink-soft sm:block">{meta}</span>}
          <Link
            to="/play"
            className="text-caption text-ink underline decoration-ink-hairline underline-offset-4 hover:decoration-brand-near"
          >
            退出房间
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-ink-hairline">
        <div className="ky-shell flex flex-col gap-2 py-6 text-micro text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <span>游客演示版 · 固定测试故事，服务重启后失效</span>
          <span>KnowYou · 基于知乎故事的二次演绎</span>
        </div>
      </footer>
    </div>
  )
}
