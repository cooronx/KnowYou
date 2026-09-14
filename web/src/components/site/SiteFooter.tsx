import {ArrowRight} from 'lucide-react'
import {Link} from 'react-router-dom'

const COLUMNS = [
  {
    title: '产品',
    links: [
      {label: '怎么玩', href: '/#how'},
      {label: '剧本间', href: '/#room'},
      {label: '认识报告', href: '/#report'},
    ],
  },
  {
    title: '内容来源',
    links: [
      {label: '知乎故事', href: '/#sources'},
      {label: '知乎创作', href: '/#sources'},
      {label: '知乎收藏', href: '/#sources'},
    ],
  },
  {
    title: '关于',
    links: [
      {label: '知乎黑客松 2026', href: '/'},
      {label: '隐私说明', href: '/'},
      {label: '内容安全', href: '/'},
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="bg-brand-near text-white">
      <div className="ky-shell grid gap-14 py-16 lg:grid-cols-[1.1fr_1fr] lg:py-20">
        <div className="max-w-md">
          <p className="font-mono text-mono-label uppercase tracking-[0.18em] text-brand-coral">Stories move fast</p>
          <h2 className="mt-4 font-display text-heading-card">订阅 KnowYou 更新</h2>
          <p className="mt-4 text-caption text-white/60">
            新剧本、新玩法上线时通知你。我们只展示基于原作的二次演绎，不会发送营销骚扰。
          </p>
          <form className="mt-8 flex items-center gap-3 border-b border-white/25 pb-3" onSubmit={(event) => event.preventDefault()}>
            <input
              type="email"
              placeholder="you@example.com"
              className="w-full bg-transparent text-body text-white placeholder:text-white/40 focus:outline-none"
            />
            <button type="submit" aria-label="订阅" className="text-brand-coral transition-colors hover:text-white">
              <ArrowRight className="h-5 w-5" />
            </button>
          </form>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          {COLUMNS.map((column) => (
            <div key={column.title} className="flex flex-col gap-4">
              <h3 className="font-mono text-micro uppercase tracking-[0.16em] text-white">{column.title}</h3>
              {column.links.map((link) => (
                <a key={link.label} href={link.href} className="text-caption text-ink-muted transition-colors hover:text-white">
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="ky-shell flex flex-col gap-3 py-6 text-micro text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <span>KnowYou · 基于知乎故事的二次演绎</span>
          <span className="flex items-center gap-4">
            <span>故事原作者署名</span>
            <Link to="/play" className="underline decoration-white/30 underline-offset-4 hover:text-white hover:decoration-white">
              分享卡 ↗
            </Link>
          </span>
        </div>
      </div>
    </footer>
  )
}
