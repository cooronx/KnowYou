import {useEffect, useState} from 'react'
import {useNavigate, useSearchParams} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {api} from '@/lib/api'
import type {SessionUser} from '@/types'

const LOGIN_ERRORS: Record<string, string> = {
  no_code: '知乎没有返回授权码，请重新登录',
  state_invalid: '登录请求已失效或来源不匹配，请重新登录',
  failed: '知乎登录失败，请重新登录',
}

export default function HomePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)

  const loginReason = searchParams.get('login')

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

  async function enter(): Promise<void> {
    setBusy(true)
    setError('')
    try {
      const data = await api.createRoom()
      localStorage.setItem('playerId', data.playerId)
      navigate(`/room/${data.code}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '加入失败')
    } finally {
      setBusy(false)
    }
  }

  async function logout(): Promise<void> {
    setBusy(true)
    try {
      await api.logout()
      setUser(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-bold">KnowYou</h1>
        <p className="text-sm text-muted-foreground">游客演示版 · 固定测试故事「走廊尽头的钥匙」</p>
      </header>

      {loginReason && (
        <p role="alert" className="text-sm text-destructive">
          {LOGIN_ERRORS[loginReason] ?? '知乎登录失败，请重新登录'}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>知乎账号</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {loadingSession ? (
            <p className="text-sm text-muted-foreground">正在读取登录状态…</p>
          ) : user ? (
            <div className="flex items-center gap-3">
              {user.avatar && <img src={user.avatar} alt="" width={32} height={32} className="rounded-full" />}
              <span>已登录：{user.fullname || user.zhihuUid}</span>
              <Button variant="outline" size="sm" disabled={busy} onClick={logout}>
                退出登录
              </Button>
            </div>
          ) : (
            // 走服务端路由发起授权：state 需要在服务端生成并写入 Cookie
            <Button asChild variant="outline" className="w-fit">
              <a href={api.loginUrl}>使用知乎账号登录</a>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>加入房间</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            测试房间，服务重启后失效。两名玩家都在这个页面点「加入房间」：先到的叫用户A，后到的叫用户B。
          </p>
          <Button disabled={busy} className="w-fit" onClick={enter}>
            加入房间
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
