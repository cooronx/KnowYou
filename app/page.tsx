'use client'

import {Suspense, useCallback, useEffect, useState} from 'react'
import {useRouter, useSearchParams} from 'next/navigation'

type SessionUser = {
  id: string
  zhihuUid: string
  fullname: string
  avatar: string
  headline: string
}

const LOGIN_ERRORS: Record<string, string> = {
  no_code: '知乎没有返回授权码，请重新登录',
  state_invalid: '登录请求已失效或来源不匹配，请重新登录',
  failed: '知乎登录失败，请重新登录',
}

/** 单独成组件：useSearchParams 会让所在组件退出预渲染，需要 Suspense 边界 */
function LoginErrorBanner() {
  const reason = useSearchParams().get('login')
  if (!reason) return null
  return <p role="alert">{LOGIN_ERRORS[reason] ?? '知乎登录失败，请重新登录'}</p>
}

export default function Home() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const router = useRouter()

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session', {cache: 'no-store'})
      const data = await response.json()
      setUser(data.user ?? null)
    } catch {
      setUser(null)
    } finally {
      setLoadingSession(false)
    }
  }, [])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  async function enter() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/rooms', {method: 'POST'})
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '加入失败')
      localStorage.setItem('playerId', data.playerId)
      router.push(`/room/${data.code}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '加入失败')
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    setBusy(true)
    try {
      await fetch('/api/auth/logout', {method: 'POST'})
      setUser(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main>
      <h1>KnowYou</h1>
      <p>游客演示版 · 固定测试故事「走廊尽头的钥匙」</p>

      <section aria-label="知乎账号">
        {loadingSession ? (
          <p>正在读取登录状态…</p>
        ) : user ? (
          <p>
            {user.avatar && (
              // 头像来自知乎 CDN，不走 next/image 优化
              <img src={user.avatar} alt="" width={32} height={32} />
            )}
            已登录：{user.fullname || user.zhihuUid}
            <button disabled={busy} onClick={logout}>
              退出登录
            </button>
          </p>
        ) : (
          // 走服务端路由发起授权：state 需要在服务端生成并写入 Cookie
          <p>
            <a href="/api/auth/login">使用知乎账号登录</a>
          </p>
        )}
        <Suspense fallback={null}>
          <LoginErrorBanner />
        </Suspense>
      </section>

      <p>测试房间，服务重启后失效。两名玩家都在这个页面点「加入房间」：先到的叫用户A，后到的叫用户B。</p>
      <button disabled={busy} onClick={enter}>
        加入房间
      </button>
      {error && <p role="alert">{error}</p>}
    </main>
  )
}
