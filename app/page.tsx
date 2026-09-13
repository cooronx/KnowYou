'use client'

import {useState} from 'react'
import {useRouter} from 'next/navigation'

export default function Home() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

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

  return (
    <main>
      <h1>KnowYou</h1>
      <p>游客演示版 · 固定测试故事「走廊尽头的钥匙」</p>
      <p>测试房间，服务重启后失效。两名玩家都在这个页面点「加入房间」：先到的叫用户A，后到的叫用户B。</p>
      <button disabled={busy} onClick={enter}>
        加入房间
      </button>
      {error && <p role="alert">{error}</p>}
    </main>
  )
}
