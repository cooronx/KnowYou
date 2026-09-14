import {useEffect, useState} from 'react'
import {ArrowUpRight, CircleDot, HeartHandshake} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {api} from '@/lib/api'
import {demoRoomPreview} from '@/lib/mock'
import type {SeedSummary} from '@/types'

function AgentConsole() {
  return (
    <div className="overflow-hidden rounded-lg bg-brand-near text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-coral" />
          <span className="font-mono text-micro uppercase tracking-[0.18em] text-white/70">Director Console</span>
        </div>
        <span className="flex items-center gap-2 font-mono text-micro uppercase tracking-[0.16em] text-brand-coral">
          <CircleDot className="h-3.5 w-3.5 animate-pulse-soft" />
          Running
        </span>
      </div>

      <div className="grid gap-5 p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-sm bg-white/10 font-mono text-micro">D</span>
            <div>
              <p className="text-caption text-white">Director Agent</p>
              <p className="font-mono text-micro uppercase tracking-[0.14em] text-white/40">推进叙事 · 生成分支</p>
            </div>
          </div>
          <span className="w-fit rounded-full border border-brand-coral/40 px-3 py-1 font-mono text-micro uppercase tracking-[0.14em] text-brand-coral">
            generating
          </span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-sm bg-white/10 font-mono text-micro">O</span>
            <div>
              <p className="text-caption text-white">Observer Agent</p>
              <p className="font-mono text-micro uppercase tracking-[0.14em] text-white/40">静默提取价值观信号</p>
            </div>
          </div>
          <span className="w-fit rounded-full border border-white/20 px-3 py-1 font-mono text-micro uppercase tracking-[0.14em] text-white/50">
            listening
          </span>
        </div>

        <div className="rounded-sm border border-white/10 bg-white/5 p-5">
          <p className="font-mono text-micro uppercase tracking-[0.16em] text-brand-coral">
            Round 02 · 暴雨夜，桥的另一端
          </p>
          <p className="mt-3 text-caption leading-relaxed text-white/80">
            你们在桥头短暂争执，最后决定由 TA 先过去，你留在原地固定绳索。水位还在上涨。
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {demoRoomPreview.branches.map((branch) => (
              <span
                key={branch.label}
                className="rounded-full border border-white/20 px-3 py-1.5 font-mono text-micro uppercase tracking-[0.12em] text-white/70"
              >
                {branch.label} · {branch.title}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-sm border border-white/10 px-4 py-3">
          <span className="font-mono text-micro uppercase tracking-[0.14em] text-white/40">你想怎么做？</span>
          <span className="h-4 w-px animate-pulse-soft bg-brand-coral" />
        </div>
      </div>
    </div>
  )
}

function StoryCard() {
  return (
    <div className="flex h-full flex-col justify-between rounded-lg bg-surface-warm p-7">
      <div className="flex items-center justify-between">
        <span className="ky-chip border-[#d6d2c9] text-ink-soft">AI Directed Story</span>
        <HeartHandshake className="h-6 w-6 text-brand-coral" strokeWidth={1.4} />
      </div>
      <div className="py-10">
        <p className="font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05] tracking-tight text-ink">
          把选择
          <br />
          变成了解
        </p>
      </div>
      <p className="font-mono text-micro uppercase tracking-[0.16em] text-ink-muted">知乎故事 · 二次演绎</p>
    </div>
  )
}

function StoryLibrary() {
  const [seeds, setSeeds] = useState<SeedSummary[]>([])

  useEffect(() => {
    let active = true
    api
      .seedList()
      .then((list) => {
        if (active) setSeeds(list)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  if (seeds.length === 0) return null

  return (
    <div className="mt-16 text-left lg:mt-20">
      <div className="flex items-end justify-between border-b border-ink-hairline pb-5">
        <div>
          <p className="ky-eyebrow">02 · Story Library</p>
          <h2 className="mt-3 font-display text-heading-feature text-ink">来自知乎故事库</h2>
        </div>
        <p className="font-mono text-micro uppercase tracking-[0.16em] text-ink-muted">{seeds.length} Stories</p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {seeds.map((seed) => {
          const cover = seed.tabArtwork || seed.artwork
          return (
            <article key={seed.workId} className="overflow-hidden rounded-md border border-ink-hairline bg-white">
              {cover && (
                <img
                  src={cover}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                  }}
                  className="h-36 w-full object-cover"
                />
              )}
              <div className="p-5">
                <p className="font-display text-heading-feature text-ink">{seed.title}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {seed.labels.slice(0, 4).map((label) => (
                    <span key={label} className="ky-chip border-ink-hairline text-ink-soft">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

export default function LandingPage({onStart}: {onStart: () => void}) {
  return (
    <section className="ky-shell pb-16 pt-16 text-center lg:pb-24 lg:pt-24">
      <p className="ky-eyebrow">01 · Match / Story Room</p>
      <h1 className="mx-auto mt-6 max-w-5xl font-display text-display-hero text-ink">
        在故事里
        <br />
        认识彼此
      </h1>
      <p className="mx-auto mt-7 max-w-2xl text-body-lg text-ink-soft">
        两个陌生人进入同一篇知乎故事，在几次共同选择里，看见对方如何面对风险、冲突与靠近。
      </p>
      <div className="mt-9 flex justify-center">
        <Button size="lg" onClick={onStart}>
          开始一局 KnowYou
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </div>
      <p className="mt-5 font-mono text-micro uppercase tracking-[0.16em] text-ink-muted">
        约 8–10 分钟 · 游客也可体验 · 无需注册
      </p>

      <div className="mt-16 grid gap-4 text-left lg:mt-20 lg:grid-cols-[1.6fr_1fr] lg:gap-6">
        <AgentConsole />
        <StoryCard />
      </div>

      <StoryLibrary />
    </section>
  )
}
