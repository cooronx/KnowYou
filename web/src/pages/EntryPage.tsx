import {useEffect, useState} from 'react'
import {ArrowUpRight, Loader2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {api} from '@/lib/api'
import type {SessionUser} from '@/types'

const LOGIN_ERRORS: Record<string, string> = {
  no_code: '知乎没有返回授权码，请重新登录',
  state_invalid: '登录请求已失效或来源不匹配，请重新登录',
  failed: '知乎登录失败，请重新登录',
}

const POINTS = [
  '两人一间，先到的叫用户 A，后到的叫用户 B。',
  '一局 3–8 个回合，双方提交后由 AI 推进剧情。',
  '终局生成同一份认识报告，每条结论都引用具体回合。',
]

export default function EntryPage({onEnter}: {onEnter: (code: string, playerId: string) => void}) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'create' | 'join' | 'logout' | null>(null)
  const [error, setError] = useState('')
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)

  const loginReason = new URLSearchParams(window.location.search).get('login')

  useEffect(() => {
    let active = true
    api
      .session()
      .then((data) => {
        if (active) setUser(data.user)
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoadingSession(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function createRoom(): Promise<void> {
    setBusy('create')
    setError('')
    try {
      const data = await api.createRoom()
      onEnter(data.code, data.playerId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '创建房间失败')
    } finally {
      setBusy(null)
    }
  }

  async function joinRoom(): Promise<void> {
    const value = code.trim().toUpperCase()
    if (!value) {
      setError('请输入房间码')
      return
    }
    setBusy('join')
    setError('')
    try {
      const data = await api.joinRoom(value)
      onEnter(data.code, data.playerId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '加入房间失败')
    } finally {
      setBusy(null)
    }
  }

  async function logout(): Promise<void> {
    setBusy('logout')
    try {
      await api.logout()
      setUser(null)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="bg-surface-warm">
      <div className="ky-shell grid gap-14 py-16 lg:grid-cols-[1fr_1.05fr] lg:gap-20 lg:py-24">
        <div className="lg:pt-6">
          <p className="ky-eyebrow">04 · Enter</p>
          <h1 className="mt-5 font-display text-heading-section text-ink">进入你的剧本间</h1>
          <p className="mt-5 max-w-md text-body-lg text-ink-soft">
            创建一间房并邀请朋友，或输入房间码加入。没有账号也可以先以游客身份体验一局。
          </p>
          <ul className="mt-10 grid gap-4">
            {POINTS.map((point) => (
              <li key={point} className="flex gap-3 border-t border-ink-hairline pt-4 text-caption text-ink-soft">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-coral" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-ink-hairline bg-white p-7 sm:p-9">
          <div>
            <p className="font-mono text-micro uppercase tracking-[0.18em] text-ink-muted">Zhihu Account</p>
            <div className="mt-4">
              {loadingSession ? (
                <p className="flex items-center gap-2 text-caption text-ink-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在读取登录状态…
                </p>
              ) : user ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-3 text-caption text-ink">
                    {user.avatar && <img src={user.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />}
                    {user.fullname || user.zhihuUid}
                  </span>
                  <Button variant="link" size="sm" disabled={busy !== null} onClick={logout}>
                    退出登录
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-4">
                  <Button asChild variant="outline">
                    <a href={api.loginUrl}>使用知乎账号登录</a>
                  </Button>
                  <span className="text-micro text-ink-muted">登录后可生成口味画像与选本推荐</span>
                </div>
              )}
            </div>
          </div>

          <div className="my-8 border-t border-ink-hairline" />

          <div>
            <p className="font-mono text-micro uppercase tracking-[0.18em] text-ink-muted">Create Room</p>
            <p className="mt-4 text-caption text-ink-soft">创建后你会自动成为用户 A，把房间码发给朋友即可开始。</p>
            <Button className="mt-4" disabled={busy !== null} onClick={createRoom}>
              {busy === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
              创建房间并加入
            </Button>
          </div>

          <div className="my-8 border-t border-ink-hairline" />

          <div>
            <label htmlFor="room-code" className="font-mono text-micro uppercase tracking-[0.18em] text-ink-muted">
              Join Room
            </label>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                id="room-code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void joinRoom()
                }}
                placeholder="输入房间码，例如 DEMO01"
                className="h-11 w-full rounded-xs border border-[#d9d9dd] bg-white px-4 font-mono text-caption uppercase tracking-[0.12em] text-ink placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-muted focus-visible:border-[#9b60aa] focus-visible:outline-none"
              />
              <Button variant="outline" disabled={busy !== null} onClick={joinRoom} className="shrink-0">
                {busy === 'join' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                加入房间
              </Button>
            </div>
          </div>

          {loginReason && (
            <p role="alert" className="mt-6 text-caption text-[#b30000]">
              {LOGIN_ERRORS[loginReason] ?? '知乎登录失败，请重新登录'}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-6 text-caption text-[#b30000]">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
