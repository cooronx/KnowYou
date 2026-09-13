'use client'

import {useState} from 'react'
import {useRouter} from 'next/navigation'

export default function Home() {
  const [name, setName] = useState('')
  const [code, setCode] = useState('DEMO01')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function enter(url: string) {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name}),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '请求失败')
      localStorage.setItem('playerId', data.playerId)
      localStorage.setItem('playerName', name)
      router.push(`/room/${data.code || code}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '请求失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main>
      <h1>KnowYou</h1>
      <p>游客演示版 · 固定测试故事「走廊尽头的钥匙」</p>
      <p>测试房间，服务重启后失效。</p>
      <label>
        昵称
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="输入昵称" />
      </label>
      <button disabled={busy} onClick={() => enter('/api/rooms')}>
        创建房间并加入
      </button>
      <hr />
      <label>
        房间码
        <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
      </label>
      <button disabled={busy} onClick={() => enter(`/api/rooms/${code}/join`)}>
        加入房间
      </button>
      {error && <p role="alert">{error}</p>}
    </main>
  )
}
