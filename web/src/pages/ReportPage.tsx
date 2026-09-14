import {useCallback, useEffect, useState, type ReactNode} from 'react'
import {ArrowUpRight, Compass, Heart, Lightbulb, Loader2, RefreshCw, Sparkles, Users} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {api, isOffline} from '@/lib/api'
import {demoHistory, mockReport} from '@/lib/mock'
import {story, type Room} from '@/types'

type Accent = 'blue' | 'coral'

function StatCard({label, value, hint, accent}: {label: string; value: string; hint: string; accent: Accent}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-5 backdrop-blur">
      <p className="font-mono text-micro uppercase tracking-[0.16em] text-white/50">{label}</p>
      <p className={`mt-3 font-display text-[2rem] leading-none ${accent === 'coral' ? 'text-brand-coral' : 'text-white'}`}>
        {value}
      </p>
      <p className="mt-2 text-micro text-white/45">{hint}</p>
    </div>
  )
}

function InsightCard({
  icon,
  label,
  items,
  accent,
}: {
  icon: ReactNode
  label: string
  items: string[]
  accent: Accent
}) {
  return (
    <article className="rounded-lg border border-ink-hairline bg-white p-7 sm:p-8">
      <div className="flex items-center gap-3">
        <span
          className={`grid h-9 w-9 place-items-center rounded-full ${
            accent === 'coral' ? 'bg-brand-coral/10 text-brand-coral' : 'bg-brand-blue/10 text-brand-blue'
          }`}
        >
          {icon}
        </span>
        <h2 className="font-mono text-micro uppercase tracking-[0.18em] text-ink-muted">{label}</h2>
      </div>
      <ul className="mt-6 grid gap-4">
        {items.map((item, index) => (
          <li key={item} className="flex gap-4 text-body text-ink-soft">
            <span className={`font-display text-heading-feature ${accent === 'coral' ? 'text-brand-coral' : 'text-brand-blue'}`}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="pt-1">{item}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}

export default function ReportPage({code, onRestart}: {code: string; onRestart: () => void}) {
  const forceDemo = new URLSearchParams(window.location.search).get('demo') === '1'

  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState('')
  const [demo, setDemo] = useState(false)

  const load = useCallback(async () => {
    if (forceDemo) {
      setDemo(true)
      return
    }
    try {
      setRoom(await api.getRoom(code))
      setDemo(false)
    } catch (caught) {
      if (isOffline(caught)) {
        setDemo(true)
        setError('后端未连接，已切换到本地演示数据')
      } else {
        setError(caught instanceof Error ? caught.message : '加载失败')
      }
    }
  }, [code, forceDemo])

  useEffect(() => {
    void load()
  }, [load])

  async function retry(): Promise<void> {
    setError('')
    try {
      setRoom(await api.retry(code))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '生成失败')
      await load()
    }
  }

  if (!room && !demo) {
    return (
      <div className="ky-shell py-20">
        <p className="text-body text-ink-soft">{error || '正在加载报告…'}</p>
      </div>
    )
  }

  const outline = room?.outline ?? story
  const report = demo ? mockReport : room?.report
  const history = demo ? demoHistory : (room?.history ?? [])
  const pending = !demo && room?.aiStatus === 'pending'
  const failed = !demo && room?.aiStatus === 'error'

  return (
    <div className="pb-20">
      <section className="relative overflow-hidden bg-brand-navy text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-coral/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-brand-blue/20 blur-3xl" />
        <div className="ky-shell relative py-16 lg:py-20">
          <p className="font-mono text-micro uppercase tracking-[0.2em] text-brand-coral">05 · Recognition Report</p>
          <h1 className="mt-5 max-w-3xl font-display text-heading-section">你们的认识报告</h1>
          <p className="mt-5 max-w-2xl text-body-lg text-white/70">
            基于《{outline.title}》的二次演绎。每一条结论都尽量指向具体回合里的选择与原话。
          </p>

          {report && (
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <StatCard label="共同点" value={String(report.common.length).padStart(2, '0')} hint="你们都一致的地方" accent="blue" />
              <StatCard
                label="差异点"
                value={String(report.differences.length).padStart(2, '0')}
                hint="你们不同的地方"
                accent="coral"
              />
              <StatCard label="一起走过" value={String(history.length).padStart(2, '0')} hint="共同完成的回合数" accent="blue" />
            </div>
          )}
        </div>
      </section>

      <div className="ky-shell">
        {demo && (
          <div className="mt-8 flex flex-wrap items-center gap-3 rounded-sm border border-brand-coral/40 bg-brand-coral/5 px-4 py-3 text-caption text-ink-soft">
            <span className="font-mono text-micro uppercase tracking-[0.14em] text-brand-coral">Demo Data</span>
            当前展示本地演示报告，启动后端并完成一局即可看到真实结论。
          </div>
        )}

        {!report && pending && (
          <p className="mt-12 flex items-center gap-3 text-body text-ink-soft">
            <Loader2 className="h-5 w-5 animate-spin text-brand-coral" />
            AI 正在生成总结…
          </p>
        )}
        {!report && failed && (
          <div className="mt-12 grid gap-4">
            <p className="text-body text-ink">{room?.aiError}</p>
            <Button className="w-fit" onClick={retry}>
              <RefreshCw className="h-4 w-4" />
              重试生成总结
            </Button>
          </div>
        )}
        {!report && !pending && !failed && (
          <p className="mt-12 text-body text-ink-soft">
            {room?.abandoned
              ? '本局因一方离开提前结束，没有生成认识报告。回到首页可以重新开一局。'
              : '故事还没有结束，先回到房间完成回合。'}
          </p>
        )}

        {report && (
          <>
            <section className="mt-14 grid gap-6 lg:grid-cols-2">
              <div className="animate-fade-up">
                <InsightCard icon={<Users className="h-4 w-4" />} label="你们的共识" items={report.common} accent="blue" />
              </div>
              <div className="animate-fade-up" style={{animationDelay: '80ms'}}>
                <InsightCard
                  icon={<Compass className="h-4 w-4" />}
                  label="你们的差异"
                  items={report.differences}
                  accent="coral"
                />
              </div>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
              <article className="animate-fade-up rounded-lg bg-brand-green p-7 text-white sm:p-9" style={{animationDelay: '120ms'}}>
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-brand-coral">
                    <Heart className="h-4 w-4" />
                  </span>
                  <h2 className="font-mono text-micro uppercase tracking-[0.18em] text-white/60">一个互补点</h2>
                </div>
                <p className="mt-6 font-display text-heading-card">{report.complement}</p>
              </article>

              <article className="animate-fade-up rounded-lg border border-ink-hairline bg-surface-warm p-7 sm:p-9" style={{animationDelay: '160ms'}}>
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-coral/15 text-brand-coral">
                    <Lightbulb className="h-4 w-4" />
                  </span>
                  <h2 className="font-mono text-micro uppercase tracking-[0.18em] text-ink-muted">下次可以聊</h2>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  {report.topics.map((topic) => (
                    <span
                      key={topic}
                      className="rounded-full border border-ink-hairline bg-white px-4 py-2 text-caption text-ink-soft"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </article>
            </section>

            <section className="mt-20">
              <div className="flex flex-col gap-3 border-b border-ink-hairline pb-5 sm:flex-row sm:items-end sm:justify-between">
                <h2 className="font-display text-heading-feature text-ink">回合回放 · 总结的证据</h2>
                <p className="text-caption text-ink-muted">每一条结论都能指回下面具体的回合。</p>
              </div>
              <div className="mt-2 flex flex-col">
                {history.map((record) => (
                  <article
                    key={record.round}
                    className="grid gap-4 border-b border-ink-hairline py-7 lg:grid-cols-[140px_1fr]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-navy font-display text-caption text-white">
                        {String(record.round).padStart(2, '0')}
                      </span>
                      <span className="font-mono text-micro uppercase tracking-[0.14em] text-brand-blue">Round</span>
                    </div>
                    <div>
                      <ul className="grid gap-3">
                        {record.entries.map((entry) => {
                          const character = outline.characters.find((item) => item.id === entry.role)
                          return (
                            <li key={entry.playerId} className="text-caption text-ink">
                              <span className="text-ink-soft">
                                {entry.name}（{character?.name ?? `角色 ${entry.role}`}）
                              </span>{' '}
                              选择了「{entry.choiceTitle}」
                              {entry.text && `：${entry.text}`}
                            </li>
                          )
                        })}
                      </ul>
                      <p className="mt-4 text-caption text-ink-soft">{record.narration}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <div className="mt-12 flex flex-col gap-4 rounded-lg bg-brand-near p-7 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-brand-coral" />
                <p className="text-body text-white/80">这份报告属于你们两个人，截图就能带走。</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button variant="inverse" onClick={onRestart}>
                  再来一局
                </Button>
                <a
                  href="#report"
                  className="inline-flex items-center gap-2 text-caption text-white underline decoration-white/30 underline-offset-4 hover:decoration-brand-coral"
                >
                  导出分享卡（含原作者署名）
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="mt-8 text-caption text-[#b30000]">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
