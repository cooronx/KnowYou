import {useCallback, useEffect, useMemo, useState} from 'react'
import {ArrowRight, Check, Clock, Loader2, RefreshCw, Users} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {api, isOffline} from '@/lib/api'
import {mockRoom} from '@/lib/mock'
import {MAX_ROUNDS, story, type Room, type SeedSummary} from '@/types'

export default function RoomPage({
  code,
  playerId,
  onReport,
  onExit,
}: {
  code: string
  playerId: string
  onReport: () => void
  onExit: () => void
}) {
  const forceDemo = new URLSearchParams(window.location.search).get('demo') === '1'

  const [room, setRoom] = useState<Room | null>(null)
  const [choiceId, setChoiceId] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [demo, setDemo] = useState(false)
  const [seeds, setSeeds] = useState<SeedSummary[]>([])
  const [seedsError, setSeedsError] = useState('')
  const [selectedWorkId, setSelectedWorkId] = useState('')
  const [starting, setStarting] = useState(false)

  const load = useCallback(async () => {
    if (forceDemo) {
      setRoom(mockRoom)
      setDemo(true)
      return
    }
    try {
      // 轮询同时充当在线心跳，服务端据此回收离线座位
      setRoom(await api.getRoom(code, playerId))
      setDemo(false)
    } catch (caught) {
      // 后端未连接（网络错误或代理 5xx）时退回本地演示数据，保证页面可预览
      if (isOffline(caught)) {
        setRoom(mockRoom)
        setDemo(true)
        setError('后端未连接，已切换到本地演示数据')
      } else {
        setError(caught instanceof Error ? caught.message : '加载失败')
      }
    }
  }, [code, playerId, forceDemo])

  useEffect(() => {
    void load()
    if (forceDemo) return
    const timer = setInterval(() => {
      void load()
    }, 1500)
    return () => clearInterval(timer)
  }, [load, forceDemo])

  useEffect(() => {
    if (forceDemo || room?.state !== 'waiting') return
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
  }, [forceDemo, room?.state])

  // 后台可能还在逐篇生成大纲，列表为空时轮询等待就绪的剧本出现
  useEffect(() => {
    if (forceDemo || room?.state !== 'waiting' || seeds.length > 0) return
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
  }, [forceDemo, room?.state, seeds.length])

  useEffect(() => {
    if (seeds.length === 0) return
    if (!seeds.some((seed) => seed.workId === selectedWorkId)) setSelectedWorkId(seeds[0].workId)
  }, [seeds, selectedWorkId])

  async function post(action: (value: string) => Promise<Room>): Promise<void> {
    if (demo) {
      setError('演示数据不可提交，请启动后端服务后重试')
      return
    }
    setError('')
    try {
      setRoom(await action(code))
      setChoiceId('')
      setText('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '操作失败')
      await load()
    }
  }

  async function start(): Promise<void> {
    if (demo) {
      setError('演示数据不可提交，请启动后端服务后重试')
      return
    }
    setStarting(true)
    setError('')
    try {
      setRoom(await api.startRoom(code, selectedWorkId || undefined))
      setChoiceId('')
      setText('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '开始失败')
      await load()
    } finally {
      setStarting(false)
    }
  }

  const activePlayerId = useMemo(() => {
    if (!room) return playerId
    return room.players[playerId] ? playerId : demo ? 'p1' : playerId
  }, [room, playerId, demo])

  if (!room) {
    return (
      <div className="ky-shell py-20">
        <p className="text-body text-ink-soft">{error || '正在加载房间…'}</p>
      </div>
    )
  }

  const outline = room.outline ?? story
  const submitted = room.submissions[activePlayerId]
  const me = room.players[activePlayerId]
  const myCharacter = outline.characters.find((character) => character.id === me?.role)
  const opponentId = room.playerIds.find((id) => id !== activePlayerId)
  const opponent = opponentId ? room.players[opponentId] : undefined
  const opponentSubmitted = opponentId ? Boolean(room.submissions[opponentId]) : false
  const selectedSeed = seeds.find((seed) => seed.workId === selectedWorkId)
  const headerTitle = room.state === 'waiting' && selectedSeed ? selectedSeed.title : outline.title

  return (
    <div className="ky-shell py-10 lg:py-14">
        {demo && (
          <div className="mb-8 flex flex-wrap items-center gap-3 rounded-sm border border-brand-coral/40 bg-brand-coral/5 px-4 py-3 text-caption text-ink-soft">
            <span className="font-mono text-micro uppercase tracking-[0.14em] text-brand-coral">Demo Data</span>
            当前展示本地演示数据，启动后端并重新进入房间即可实时对局。
          </div>
        )}

        <div className="flex flex-col gap-3 border-b border-ink-hairline pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="ky-eyebrow">
              {room.state === 'waiting' ? 'Room · Waiting' : room.state === 'playing' ? 'Room · Playing' : 'Room · Finished'}
            </p>
            <h1 className="mt-4 font-display text-heading-section text-ink">{headerTitle}</h1>
          </div>
          <div className="flex items-center gap-4 font-mono text-micro uppercase tracking-[0.16em] text-ink-muted">
            <span>Code {room.code}</span>
            <span className="hidden h-4 w-px bg-ink-hairline sm:block" />
            <span>
              Round {room.round} / {MAX_ROUNDS}
            </span>
          </div>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
          <div className="flex flex-col gap-10">
            {room.state === 'waiting' && (
              <>
                <section className="rounded-lg bg-surface-warm p-7 sm:p-10">
                  <p className="font-mono text-micro uppercase tracking-[0.18em] text-ink-muted">Invite Code</p>
                  <p className="mt-4 font-display text-[clamp(2.5rem,7vw,4.5rem)] leading-none tracking-tight text-ink">
                    {room.code}
                  </p>
                  <p className="mt-5 max-w-lg text-body text-ink-soft">
                    把房间码发给朋友，两人到齐后由任一玩家开始。房间只保存在当前服务进程，重启后失效。
                  </p>
                </section>

                <section className="border-t border-ink-hairline pt-8">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="font-display text-heading-feature text-ink">选择剧本</h2>
                      <p className="mt-2 text-caption text-ink-soft">
                        剧本来自知乎故事库，选定后由 AI 提炼成两人的共同处境。
                      </p>
                    </div>
                    {seeds.length > 0 && (
                      <p className="font-mono text-micro uppercase tracking-[0.16em] text-ink-muted">
                        {seeds.length} Stories
                      </p>
                    )}
                  </div>

                  {seedsError && (
                    <p className="mt-6 text-caption text-[#b30000]">剧本库读取失败：{seedsError}</p>
                  )}
                  {seeds.length === 0 && !seedsError && (
                    <p className="mt-6 flex items-center gap-3 text-caption text-ink-muted">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      剧本正在生成中，就绪后会自动出现…
                    </p>
                  )}

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {seeds.map((seed) => {
                      const active = seed.workId === selectedWorkId
                      const cover = seed.tabArtwork || seed.artwork
                      const intro = seed.description.length > 52 ? `${seed.description.slice(0, 52)}…` : seed.description
                      return (
                        <button
                          key={seed.workId}
                          type="button"
                          onClick={() => setSelectedWorkId(seed.workId)}
                          className={`flex flex-col overflow-hidden rounded-md border text-left transition-colors ${
                            active ? 'border-brand-coral bg-brand-coral/5' : 'border-ink-hairline bg-white hover:border-ink-muted'
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
                              className="h-32 w-full object-cover"
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
              </>
            )}

            {room.state === 'playing' && (
              <>
                {room.history.length > 0 && (
                  <section>
                    <h2 className="font-mono text-micro uppercase tracking-[0.18em] text-ink-muted">Story Log</h2>
                    <div className="mt-5 flex flex-col">
                      {room.history.map((record) => (
                        <article key={record.round} className="border-t border-ink-hairline py-6 first:border-t-0 first:pt-0">
                          <p className="font-mono text-micro uppercase tracking-[0.16em] text-brand-blue">Round {record.round}</p>
                          <ul className="mt-4 grid gap-2">
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
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                {room.choices.length === 0 ? (
                  <section className="rounded-lg bg-surface-warm p-7 sm:p-9">
                    {room.aiStatus === 'pending' && (
                      <p className="flex items-center gap-3 text-body text-ink-soft">
                        <Loader2 className="h-5 w-5 animate-spin text-brand-coral" />
                        AI 正在生成开场…
                      </p>
                    )}
                    {room.aiStatus === 'error' && (
                      <>
                        <p className="text-body text-ink">{room.aiError}</p>
                        <Button className="mt-5" onClick={() => post((value) => api.retry(value))}>
                          <RefreshCw className="h-4 w-4" />
                          重试生成开场
                        </Button>
                      </>
                    )}
                  </section>
                ) : (
                  <>
                    <section className="rounded-lg bg-brand-green p-7 text-white sm:p-9">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-mono text-micro uppercase tracking-[0.18em] text-brand-coral-soft">
                          Round {room.round} / {MAX_ROUNDS}
                        </p>
                        {room.aiStatus === 'pending' && (
                          <span className="flex items-center gap-2 font-mono text-micro uppercase tracking-[0.14em] text-white/60">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            AI advancing
                          </span>
                        )}
                      </div>
                      <h2 className="mt-5 font-display text-heading-card">{room.scene}</h2>
                      <p className="mt-4 max-w-2xl text-body-lg text-white/75">{room.narration}</p>

                      {submitted ? (
                        <p className="mt-8 text-caption text-white/60">
                          你已提交「
                          {room.choices.find((item) => item.id === submitted.choiceId)?.title ?? submitted.choiceId}
                          」{submitted.text && `：${submitted.text}`}，等待对方…
                        </p>
                      ) : (
                        <div className="mt-8 grid gap-3 sm:grid-cols-3">
                          {room.choices.map((choice) => {
                            const active = choiceId === choice.id
                            return (
                              <button
                                key={choice.id}
                                type="button"
                                onClick={() => setChoiceId(choice.id)}
                                className={`rounded-md border p-5 text-left transition-colors ${
                                  active
                                    ? 'border-brand-coral bg-white/10'
                                    : 'border-white/15 bg-white/5 hover:border-white/40'
                                }`}
                              >
                                <span className="font-mono text-micro uppercase tracking-[0.16em] text-brand-coral">
                                  {choice.id.toUpperCase()}
                                </span>
                                <p className="mt-2 font-display text-heading-feature">{choice.title}</p>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </section>

                    {room.aiStatus === 'error' && (
                      <section className="rounded-lg border border-[#b30000]/30 bg-[#b30000]/5 p-7">
                        <p className="text-body text-ink">{room.aiError}</p>
                        <Button className="mt-5" onClick={() => post((value) => api.retry(value))}>
                          <RefreshCw className="h-4 w-4" />
                          重试推进剧情
                        </Button>
                      </section>
                    )}

                    {!submitted && room.aiStatus !== 'error' && (
                      <section className="rounded-lg border border-ink-hairline bg-white p-6 sm:p-7">
                        <label htmlFor="action" className="font-mono text-micro uppercase tracking-[0.18em] text-ink-muted">
                          Your Move
                        </label>
                        <textarea
                          id="action"
                          maxLength={120}
                          value={text}
                          onChange={(event) => setText(event.target.value)}
                          placeholder="一句行动或台词（可选，最多 120 字）"
                          className="mt-4 min-h-24 w-full rounded-xs border border-[#d9d9dd] bg-white px-4 py-3 text-caption leading-relaxed text-ink placeholder:text-ink-muted focus-visible:border-[#9b60aa] focus-visible:outline-none"
                        />
                        <div className="mt-4 flex items-center justify-between">
                          <span className="font-mono text-micro text-ink-muted">{text.length} / 120</span>
                          <Button
                            disabled={!choiceId || room.aiStatus === 'pending' || demo}
                            onClick={() => post((value) => api.submitTurn(value, {playerId: activePlayerId, choiceId, text}))}
                          >
                            提交本回合
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </section>
                    )}
                  </>
                )}
              </>
            )}

            {room.state === 'finished' && (
              <section className="rounded-lg bg-brand-navy p-8 text-white sm:p-10">
                <p className="font-mono text-micro uppercase tracking-[0.18em] text-brand-coral">The End</p>
                <h2 className="mt-4 font-display text-heading-card">
                  {room.abandoned ? '本局因一方离开已结束。' : room.endingReason || '故事已经收束。'}
                </h2>
                {room.abandoned ? (
                  <>
                    <p className="mt-4 max-w-xl text-body text-white/70">
                      故事没有走到终局，这一局不生成认识报告。回到首页即可重新创建房间，再邀请对方开一局。
                    </p>
                    <Button className="mt-7" variant="inverse" onClick={onExit}>
                      回首页重开一局
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="mt-4 max-w-xl text-body text-white/70">
                      你们的每一次选择都已记录，接下来生成属于你们的同一份认识报告。
                    </p>
                    <Button className="mt-7" variant="inverse" onClick={onReport}>
                      查看共同总结
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-5">
            {myCharacter && me ? (
              <div className="rounded-lg border border-ink-hairline bg-white p-6">
                <p className="font-mono text-micro uppercase tracking-[0.18em] text-ink-muted">You</p>
                <p className="mt-3 font-display text-heading-feature text-ink">{myCharacter.name}</p>
                <p className="mt-3 text-caption text-ink-soft">目标：{myCharacter.goal}</p>
                <p className="mt-1 text-caption text-ink-soft">性格：{myCharacter.traits}</p>
                <div className="mt-5 flex items-center gap-2 border-t border-ink-hairline pt-4 text-caption text-ink-soft">
                  {submitted ? <Check className="h-4 w-4 text-brand-coral" /> : <Clock className="h-4 w-4 text-ink-muted" />}
                  {submitted ? '你已提交本回合' : '等待你的选择'}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-[#b30000]/30 bg-[#b30000]/5 p-6 text-caption text-[#b30000]">
                当前浏览器没有本房间的玩家身份，请回首页重新加入。
              </div>
            )}

            <div className="rounded-lg border border-ink-hairline bg-white p-6">
              <p className="font-mono text-micro uppercase tracking-[0.18em] text-ink-muted">Players</p>
              <ul className="mt-4 grid gap-3">
                {room.playerIds.map((id) => {
                  const player = room.players[id]
                  const character = outline.characters.find((item) => item.id === player.role)
                  const done = Boolean(room.submissions[id])
                  return (
                    <li key={id} className="flex items-center justify-between gap-3 text-caption">
                      <span className="flex items-center gap-2 text-ink">
                        <Users className="h-4 w-4 text-ink-muted" />
                        {player.name} · {character?.name}
                        {id === activePlayerId && <span className="text-brand-blue">（你）</span>}
                      </span>
                      {done ? (
                        <span className="flex items-center gap-1 font-mono text-micro uppercase tracking-[0.12em] text-brand-coral">
                          <Check className="h-3.5 w-3.5" />
                          已提交
                        </span>
                      ) : (
                        <span className="font-mono text-micro uppercase tracking-[0.12em] text-ink-muted">等待中</span>
                      )}
                    </li>
                  )
                })}
              </ul>
              {opponent && (
                <p className="mt-4 border-t border-ink-hairline pt-4 text-micro text-ink-muted">
                  {opponentSubmitted ? `${opponent.name} 已提交，AI 即将推进。` : `${opponent.name} 还在思考，提交后自动进入下一回合。`}
                </p>
              )}
            </div>

            {room.state === 'waiting' && (
              <div className="rounded-lg bg-surface-warm p-6">
                <p className="font-mono text-micro uppercase tracking-[0.18em] text-ink-muted">Start</p>
                <p className="mt-3 text-caption text-ink-soft">
                  已加入 {room.playerIds.length} / 2 人。两人到齐后即可开始这一局。
                </p>
                {selectedSeed ? (
                  <p className="mt-3 text-caption text-ink-soft">已选剧本《{selectedSeed.title}》。</p>
                ) : (
                  <p className="mt-3 text-caption text-ink-soft">剧本正在生成中，就绪后即可开始。</p>
                )}
                <Button
                  className="mt-5 w-full"
                  disabled={
                    demo || room.playerIds.length !== 2 || room.aiStatus === 'pending' || starting || !selectedWorkId
                  }
                  onClick={start}
                >
                  {starting || room.aiStatus === 'pending' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {starting ? '正在生成剧本…' : '开始游戏'}
                </Button>
              </div>
            )}
          </aside>
        </div>
      </div>
  )
}
