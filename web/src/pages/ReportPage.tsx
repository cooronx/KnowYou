import {useCallback, useEffect, useState} from 'react'
import {ArrowUpRight, Loader2, RefreshCw} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {api, isOffline} from '@/lib/api'
import {demoHistory, mockReport} from '@/lib/mock'
import {story, type Room} from '@/types'

type Accent = 'blue' | 'coral'

function ReportBlock({
  label,
  items,
  body,
  accent = 'blue',
}: {
  label: string
  items?: string[]
  body?: string
  accent?: Accent
}) {
  return (
    <div className={`border-t-2 pt-5 ${accent === 'coral' ? 'border-brand-coral' : 'border-brand-blue'}`}>
      <h2 className="font-mono text-micro uppercase tracking-[0.18em] text-ink-muted">{label}</h2>
      {body && <p className="mt-4 text-body text-ink">{body}</p>}
      {items && (
        <ul className="mt-4 grid gap-3">
          {items.map((item) => (
            <li key={item} className="flex gap-3 text-body text-ink-soft">
              <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${accent === 'coral' ? 'bg-brand-coral' : 'bg-brand-blue'}`} />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
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
    <div className="ky-shell py-10 lg:py-14">
      {demo && (
          <div className="mb-8 flex flex-wrap items-center gap-3 rounded-sm border border-brand-coral/40 bg-brand-coral/5 px-4 py-3 text-caption text-ink-soft">
            <span className="font-mono text-micro uppercase tracking-[0.14em] text-brand-coral">Demo Data</span>
            当前展示本地演示报告，启动后端并完成一局即可看到真实结论。
          </div>
        )}

        <header className="border-b border-ink-hairline pb-8">
          <p className="ky-eyebrow">05 · Recognition Report</p>
          <h1 className="mt-4 font-display text-heading-section text-ink">认识报告</h1>
          <p className="mt-4 max-w-2xl text-body text-ink-soft">
            基于《{outline.title}》的二次演绎。双方看到同一份报告，每一条结论都引用具体回合里的选择与原话。
          </p>
        </header>

        <div className="mt-10">
          {!report && pending && (
            <p className="flex items-center gap-3 text-body text-ink-soft">
              <Loader2 className="h-5 w-5 animate-spin text-brand-coral" />
              AI 正在生成总结…
            </p>
          )}
          {!report && failed && (
            <div className="grid gap-4">
              <p className="text-body text-ink">{room?.aiError}</p>
              <Button className="w-fit" onClick={retry}>
                <RefreshCw className="h-4 w-4" />
                重试生成总结
              </Button>
            </div>
          )}
          {!report && !pending && !failed && (
            <p className="text-body text-ink-soft">故事还没有结束，先回到房间完成回合。</p>
          )}
        </div>

        {report && (
          <>
            <section className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2">
              <ReportBlock label={`你们的共识 × ${String(report.common.length).padStart(2, '0')}`} items={report.common} />
              <ReportBlock
                label={`你们的差异 × ${String(report.differences.length).padStart(2, '0')}`}
                items={report.differences}
                accent="coral"
              />
              <ReportBlock label="一个互补点" body={report.complement} />
              <ReportBlock label="下次可以聊" items={report.topics} accent="coral" />
            </section>

            <section className="mt-20">
              <div className="flex flex-col gap-3 border-b border-ink-hairline pb-5 sm:flex-row sm:items-end sm:justify-between">
                <h2 className="font-display text-heading-feature text-ink">回合回放 · 总结的证据</h2>
                <p className="text-caption text-ink-muted">每一条结论都能指回下面具体的回合。</p>
              </div>
              <div className="flex flex-col">
                {history.map((record) => (
                  <article key={record.round} className="grid gap-4 border-b border-ink-hairline py-7 lg:grid-cols-[140px_1fr]">
                    <p className="font-mono text-micro uppercase tracking-[0.16em] text-brand-blue">
                      Round {String(record.round).padStart(2, '0')}
                    </p>
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

            <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button variant="outline" onClick={onRestart}>
                再来一局
              </Button>
              <a
                href="#report"
                className="inline-flex items-center gap-2 text-caption text-ink underline decoration-ink-hairline underline-offset-4 hover:decoration-brand-near"
              >
                导出分享卡（含原作者署名）
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="mt-8 text-caption text-[#b30000]">
            {error}
          </p>
        )}
      </div>
  )
}
