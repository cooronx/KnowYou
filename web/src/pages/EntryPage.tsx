import {useEffect, useState} from 'react'
import {Check, Loader2, Sparkles, Users} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {api} from '@/lib/api'
import type {SeedSummary, SessionUser} from '@/types'

const LOGIN_ERRORS: Record<string, string> = {
  no_code: '知乎没有返回授权码，请重新登录',
  state_invalid: '登录请求已失效或来源不匹配，请重新登录',
  failed: '知乎登录失败，请重新登录',
}

export default function EntryPage({onEnter}: {onEnter: (code: string, playerId: string) => void}) {
  const [seeds, setSeeds] = useState<SeedSummary[]>([])
  const [seedsError, setSeedsError] = useState('')
  const [selectedWorkId, setSelectedWorkId] = useState('')
  const [matching, setMatching] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState<SessionUser | null>(null)

  const loginReason = new URLSearchParams(window.location.search).get('login')

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

  useEffect(() => {
    let active = true
    api
      .seedList()
      .then((list) => {
        if (!active) return
        setSeeds(list)
        setSeedsError('')
      })
      .catch((caught) => {
        if (active) setSeedsError(caught instanceof Error ? caught.message : '剧本库加载失败')
      })
    return () => {
      active = false
    }
  }, [])

  // 后台可能还在逐篇生成大纲，列表为空时轮询等待就绪的剧本出现
  useEffect(() => {
    if (seeds.length > 0) return
    let active = true
    const timer = setInterval(() => {
      api
        .seedList()
        .then((list) => {
          if (!active) return
          setSeeds(list)
          setSeedsError('')
        })
        .catch(() => undefined)
    }, 5000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [seeds.length])

  useEffect(() => {
    if (seeds.length === 0) return
    if (!seeds.some((seed) => seed.workId === selectedWorkId)) setSelectedWorkId(seeds[0].workId)
  }, [seeds, selectedWorkId])

  async function startMatch(): Promise<void> {
    if (!selectedWorkId) {
      setError('请先选择一个剧本')
      return
    }
    setMatching(true)
    setError('')
    try {
      // 这里没有真实的匹配系统：留一点仪式感后直接开局，由服务端补一个虚拟对手
      await new Promise((resolve) => setTimeout(resolve, 1600))
      const data = await api.startDemo(selectedWorkId)
      onEnter(data.code, data.playerId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '匹配失败，请重试')
      setMatching(false)
    }
  }

  async function logout(): Promise<void> {
    try {
      await api.logout()
      setUser(null)
    } catch {
      // 退出失败不影响页面浏览
    }
  }

  const selectedSeed = seeds.find((seed) => seed.workId === selectedWorkId)

  return (
    <div className="bg-surface-warm">
      <div className="ky-shell py-16 lg:py-24">
        <div className="flex flex-col gap-4 border-b border-ink-hairline pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="ky-eyebrow">04 · Enter</p>
            <h1 className="mt-5 font-display text-heading-section text-ink">选一个剧本，开始这局</h1>
            <p className="mt-4 max-w-xl text-body-lg text-ink-soft">
              选定剧本后会随机匹配一位同行者。没有账号也可以先以游客身份体验一局。
            </p>
          </div>
          <div className="flex items-center gap-3 text-caption text-ink-soft">
            {user ? (
              <>
                {user.avatar && <img src={user.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />}
                <span>{user.fullname || user.zhihuUid}</span>
                <Button variant="link" size="sm" onClick={logout}>
                  退出登录
                </Button>
              </>
            ) : (
              <a
                href={api.loginUrl}
                className="text-caption text-ink underline decoration-ink-hairline underline-offset-4 hover:decoration-brand-near"
              >
                使用知乎账号登录
              </a>
            )}
          </div>
        </div>

        <section className="mt-10">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-heading-feature text-ink">选择剧本</h2>
              <p className="mt-2 text-caption text-ink-soft">剧本来自知乎故事库，选定后由 AI 提炼成两人的共同处境。</p>
            </div>
            {seeds.length > 0 && (
              <p className="font-mono text-micro uppercase tracking-[0.16em] text-ink-muted">{seeds.length} Stories</p>
            )}
          </div>

          {seedsError && <p className="mt-6 text-caption text-[#b30000]">剧本库读取失败：{seedsError}</p>}
          {seeds.length === 0 && !seedsError && (
            <p className="mt-6 flex items-center gap-3 text-caption text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              剧本正在生成中，就绪后会自动出现…
            </p>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {seeds.map((seed) => {
              const active = seed.workId === selectedWorkId
              const cover = seed.tabArtwork || seed.artwork
              const intro = seed.description.length > 60 ? `${seed.description.slice(0, 60)}…` : seed.description
              return (
                <button
                  key={seed.workId}
                  type="button"
                  disabled={matching}
                  onClick={() => setSelectedWorkId(seed.workId)}
                  className={`flex flex-col overflow-hidden rounded-md border text-left transition-all ${
                    active
                      ? 'border-brand-coral bg-white shadow-[0_18px_40px_-24px_rgba(255,119,89,0.65)]'
                      : 'border-ink-hairline bg-white hover:border-ink-muted'
                  }`}
                >
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
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-micro uppercase tracking-[0.16em] text-brand-blue">知乎故事</span>
                      {active && <Check className="h-4 w-4 text-brand-coral" />}
                    </div>
                    <p className="mt-3 font-display text-heading-feature text-ink">{seed.title}</p>
                    {intro && <p className="mt-2 text-caption text-ink-soft">{intro}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {seed.labels.slice(0, 5).map((label) => (
                        <span key={label} className="ky-chip border-ink-hairline text-ink-soft">
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <div className="sticky bottom-4 mt-10">
          <div className="flex flex-col gap-4 rounded-lg border border-ink-hairline bg-white/95 p-5 shadow-[0_24px_60px_-30px_rgba(7,24,41,0.45)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-micro uppercase tracking-[0.16em] text-ink-muted">Next</p>
              <p className="mt-2 text-caption text-ink-soft">
                {selectedSeed ? `已选《${selectedSeed.title}》，点击右侧开始匹配。` : '先选择一个剧本。'}
              </p>
            </div>
            <Button
              className="w-full sm:w-auto"
              disabled={matching || !selectedWorkId}
              onClick={startMatch}
            >
              {matching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              随机开始匹配
            </Button>
          </div>
        </div>

        {(error || loginReason) && (
          <p role="alert" className="mt-6 text-caption text-[#b30000]">
            {error || LOGIN_ERRORS[loginReason ?? ''] || '知乎登录失败，请重新登录'}
          </p>
        )}
      </div>

      {matching && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-brand-near/85 px-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-white/10 bg-brand-near p-8 text-center text-white">
            <div className="flex items-center justify-center gap-6">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-white/10">
                <Users className="h-6 w-6 text-brand-coral" />
              </span>
              <span className="flex gap-1">
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-brand-coral"
                    style={{animationDelay: `${index * 0.2}s`}}
                  />
                ))}
              </span>
              <span className="grid h-14 w-14 animate-pulse-soft place-items-center rounded-full border border-brand-coral/50 bg-brand-coral/10">
                <Sparkles className="h-6 w-6 text-brand-coral" />
              </span>
            </div>
            <p className="mt-8 font-display text-heading-feature">正在匹配同行者…</p>
            <p className="mt-3 text-caption text-white/60">正在为《{selectedSeed?.title ?? '剧本'}》寻找另一位玩家</p>
          </div>
        </div>
      )}
    </div>
  )
}
