'use client'

import {useCallback, useEffect, useState} from 'react'
import {useParams, useRouter} from 'next/navigation'
import type {Room} from '@/lib/room-store'

export default function ReportPage() {
  const {code} = useParams<{code: string}>()
  const router = useRouter()
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/rooms/${code}`, {cache: 'no-store'})
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '房间不存在')
      setRoom(data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '加载失败')
    }
  }, [code])

  useEffect(() => {
    load()
  }, [load])

  async function retry(): Promise<void> {
    setError('')
    try {
      const response = await fetch(`/api/rooms/${code}/retry`, {method: 'POST'})
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '生成失败')
      setRoom(data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '生成失败')
      await load()
    }
  }

  if (!room) return <main><p>{error || '加载中…'}</p></main>

  const report = room.report

  return (
    <main>
      <h1>共同总结</h1>
      <p>游客演示版 · 固定测试故事「走廊尽头的钥匙」</p>

      {!report && room.aiStatus === 'pending' && <p>AI 正在生成总结…</p>}
      {!report && room.aiStatus === 'error' && (
        <>
          <p role="alert">{room.aiError}</p>
          <button onClick={retry}>重试生成总结</button>
        </>
      )}
      {!report && room.aiStatus === 'idle' && room.state !== 'finished' && (
        <p>故事还没有结束，先回到房间完成回合。</p>
      )}

      {report && (
        <>
          <section>
            <h2>你们的共同点</h2>
            <ul>{report.common.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section>
            <h2>你们的差异点</h2>
            <ul>{report.differences.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section>
            <h2>互补点</h2>
            <p>{report.complement}</p>
          </section>
          <section>
            <h2>下次可以聊</h2>
            <ul>{report.topics.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        </>
      )}

      <section>
        <h2>回合回放（总结的证据）</h2>
        {room.history.map((record) => (
          <article key={record.round}>
            <h3>第 {record.round} 回合</h3>
            <ul>
              {record.entries.map((entry) => (
                <li key={entry.playerId}>
                  {entry.name}（角色 {entry.role}）选择了「{entry.choiceTitle}」
                  {entry.text && `，${entry.text}`}
                </li>
              ))}
            </ul>
            <p>{record.narration}</p>
          </article>
        ))}
      </section>

      <button
        onClick={() => {
          window.localStorage.removeItem('playerId')
          router.push('/')
        }}
      >
        再来一局
      </button>
      {error && <p role="alert">{error}</p>}
    </main>
  )
}
