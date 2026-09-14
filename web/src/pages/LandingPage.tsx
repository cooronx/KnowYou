import {
  ArrowUpRight,
  BookOpen,
  Check,
  CircleDot,
  Clock,
  DoorOpen,
  FileText,
  GitBranch,
  HeartHandshake,
  KeyRound,
  Users,
} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {demoReportPreview, demoRoomPreview, landingSteps, trustSources} from '@/lib/mock'

const STEP_ICONS = [DoorOpen, KeyRound, GitBranch, FileText]

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
      <p className="font-mono text-micro uppercase tracking-[0.16em] text-ink-muted">
        知乎故事 · 二次演绎
      </p>
    </div>
  )
}

export default function LandingPage({onStart}: {onStart: () => void}) {
  return (
    <>
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
        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
          <Button size="lg" onClick={onStart}>
            开始一局 KnowYou
            <ArrowUpRight className="h-4 w-4" />
          </Button>
          <a
            href="#report"
            className="text-caption text-ink underline decoration-ink-hairline underline-offset-4 hover:decoration-brand-near"
          >
            先看一份认识报告
          </a>
        </div>
        <p className="mt-5 font-mono text-micro uppercase tracking-[0.16em] text-ink-muted">
          约 8–10 分钟 · 游客也可体验 · 无需注册
        </p>

        <div className="mt-16 grid gap-4 text-left lg:mt-20 lg:grid-cols-[1.6fr_1fr] lg:gap-6">
          <AgentConsole />
          <StoryCard />
        </div>
      </section>

      <section id="sources" className="border-t border-ink-hairline">
        <div className="ky-shell py-16 text-center lg:py-20">
          <p className="mx-auto max-w-2xl text-caption text-ink-soft">
            内容与画像来自知乎开放能力，AI 生成部分均为基于原作的二次演绎，署名与来源固定展示。
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-14 gap-y-6">
            {trustSources.map((source) => (
              <span key={source} className="font-display text-[22px] text-ink-muted">
                {source}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="border-t border-ink-hairline">
        <div className="ky-shell py-20 lg:py-28">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="ky-eyebrow">02 · How it works</p>
              <h2 className="mt-4 font-display text-heading-section text-ink">一局游戏，四个瞬间</h2>
            </div>
            <p className="max-w-md text-body text-ink-soft">
              AI 负责推演与收束，你们只负责在关键处做出选择。了解，从具体证据里长出来。
            </p>
          </div>

          <div className="mt-14 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {landingSteps.map((step, index) => {
              const Icon = STEP_ICONS[index] ?? DoorOpen
              return (
                <div key={step.index} className="border-t border-ink-hairline pt-6">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-micro uppercase tracking-[0.16em] text-brand-blue">
                      {step.index} / {step.phase}
                    </span>
                    <Icon className="h-6 w-6 text-ink-soft" strokeWidth={1.4} />
                  </div>
                  <h3 className="mt-8 font-display text-heading-feature text-ink">{step.title}</h3>
                  <p className="mt-3 text-caption text-ink-soft">{step.detail}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section id="room" className="bg-brand-green text-white">
        <div className="ky-shell grid gap-12 py-20 lg:grid-cols-[1.55fr_1fr] lg:gap-16 lg:py-28">
          <div>
            <p className="font-mono text-mono-label uppercase tracking-[0.18em] text-brand-coral-soft">
              Room {demoRoomPreview.code} · Round {demoRoomPreview.round}
            </p>
            <h2 className="mt-6 font-display text-heading-section">{demoRoomPreview.scene}</h2>
            <p className="mt-5 max-w-xl text-body-lg text-white/70">{demoRoomPreview.narration}</p>

            <div className="mt-6 flex flex-wrap gap-2">
              {demoRoomPreview.chips.map((chip, index) => (
                <span
                  key={chip}
                  className={`rounded-full border px-3 py-1.5 font-mono text-micro uppercase tracking-[0.12em] ${
                    index === 2 ? 'border-brand-coral/50 text-brand-coral' : 'border-white/25 text-white/70'
                  }`}
                >
                  {chip}
                </span>
              ))}
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {demoRoomPreview.branches.map((branch) => (
                <div key={branch.label} className="rounded-sm border border-white/15 bg-white/5 p-5">
                  <span className="font-mono text-micro uppercase tracking-[0.16em] text-brand-coral">{branch.label}</span>
                  <p className="mt-3 font-display text-heading-feature">{branch.title}</p>
                  <p className="mt-2 text-caption text-white/60">{branch.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="border-white/15 lg:border-l lg:pl-10">
            <p className="font-mono text-micro uppercase tracking-[0.18em] text-white/50">Players</p>
            <ul className="mt-5 grid gap-4">
              {demoRoomPreview.players.map((player) => (
                <li key={player.name} className="flex items-center gap-3 text-body">
                  {player.submitted ? (
                    <Check className="h-4 w-4 text-brand-coral" />
                  ) : (
                    <CircleDot className="h-4 w-4 text-white/40" />
                  )}
                  <span className="text-white">{player.name}</span>
                  <span className="font-mono text-micro uppercase tracking-[0.14em] text-white/50">{player.state}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 border-t border-white/15 pt-6">
              <p className="flex items-center gap-2 font-mono text-micro uppercase tracking-[0.18em] text-white/50">
                <Clock className="h-3.5 w-3.5" />
                {demoRoomPreview.timer}
              </p>
              <p className="mt-2 text-caption text-white/60">本回合剩余时间，超时由 AI 代生成保守动作。</p>
            </div>
            <div className="mt-8 flex items-center gap-2 text-caption text-white/60">
              <Users className="h-4 w-4" />
              两人一间，先到的叫用户 A，后到的叫用户 B。
            </div>
          </aside>
        </div>
      </section>

      <section id="report" className="border-t border-ink-hairline">
        <div className="ky-shell py-20 lg:py-28">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="ky-eyebrow">03 · Recognition Report</p>
              <h2 className="mt-4 font-display text-heading-section text-ink">认识报告 · 共同完成的一页</h2>
            </div>
            <p className="max-w-md text-body text-ink-soft">
              每一条结论都引用具体回合里的选择与原话，双方看到同一份报告。
            </p>
          </div>

          <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2">
            {demoReportPreview.map((item, index) => (
              <div key={item.title} className={`border-t-2 pt-5 ${index % 3 === 1 ? 'border-brand-coral' : 'border-brand-blue'}`}>
                <h3 className="font-display text-heading-feature text-ink">{item.title}</h3>
                <p className="mt-3 text-body text-ink-soft">{item.body}</p>
                {item.evidence && <p className="mt-3 text-caption text-ink-muted">证据：{item.evidence}</p>}
              </div>
            ))}
          </div>

          <div className="mt-12 flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-ink-soft" strokeWidth={1.4} />
            <a
              href="#room"
              className="text-caption text-ink underline decoration-ink-hairline underline-offset-4 hover:decoration-brand-near"
            >
              看看报告是怎么从回合里生成的
            </a>
          </div>
        </div>
      </section>

      <section className="bg-brand-navy text-white">
        <div className="ky-shell flex flex-col items-center py-20 text-center lg:py-28">
          <p className="font-mono text-mono-label uppercase tracking-[0.18em] text-brand-coral">Start a room</p>
          <h2 className="mt-5 max-w-3xl font-display text-section-display">
            比聊一晚天
            <br />
            更快认识一个人
          </h2>
          <p className="mt-6 max-w-xl text-body-lg text-white/70">
            一间房、两个人、一篇知乎故事。你在关键处的每一次选择，都会成为报告里的一行证据。
          </p>
          <div className="mt-9">
            <Button variant="inverse" size="lg" onClick={onStart}>
              开始一局 KnowYou
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-5 font-mono text-micro uppercase tracking-[0.16em] text-white/50">
            Guest mode · 无需注册即可体验
          </p>
        </div>
      </section>
    </>
  )
}
