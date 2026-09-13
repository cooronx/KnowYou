'use client'

import {useCallback, useEffect, useState} from 'react'
import {useParams, useRouter} from 'next/navigation'
import {MAX_ROUNDS, story} from '@/lib/story'
import type {Room} from '@/lib/room-store'

export default function RoomPage() {
  const {code} = useParams<{code: string}>()
  const router = useRouter()
  const [room, setRoom] = useState<Room | null>(null)
  const [playerId, setPlayerId] = useState('')
  const [choiceId, setChoiceId] = useState('')
  const [text, setText] = useState('')
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
    setPlayerId(window.localStorage.getItem('playerId') ?? '')
    load()
    const timer = setInterval(load, 1500)
    return () => clearInterval(timer)
  }, [load])

  async function post(path: string, body?: unknown): Promise<void> {
    setError('')
    try {
      const response = await fetch(`/api/rooms/${code}${path}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '操作失败')
      setRoom(data)
      setChoiceId('')
      setText('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '操作失败')
      await load()
    }
  }

  if (!room) return <main><p>{error || '加载中…'}</p></main>

  const submitted = room.submissions[playerId]

  return (
    <main>
      <h1>{story.title}</h1>
      <p>游客演示版 · 固定测试故事 · 测试房间，重启后失效</p>
      <ul>
        {room.playerIds.map((id) => (
          <li key={id}>
            {room.players[id].name}（角色 {room.players[id].role}）
          </li>
        ))}
      </ul>

      {room.state === 'waiting' && (
        <section>
          <h2>等待玩家（{room.playerIds.length}/2）</h2>
          {room.playerIds.length < 2 && <p>把房间码 {room.code} 发给同伴加入。</p>}
          <p>{story.summary}</p>
          <h3>开场</h3>
          <p>{story.opening}</p>
          <h3>角色卡</h3>
          <ul>
            {story.characters.map((character) => (
              <li key={character.id}>
                {character.name}：目标「{character.goal}」，性格：{character.traits}
              </li>
            ))}
          </ul>
          <button disabled={room.playerIds.length !== 2} onClick={() => post('/start')}>
            开始游戏
          </button>
        </section>
      )}

      {room.state === 'playing' && (
        <section>
          <h2>第 {room.round}/{MAX_ROUNDS} 回合</h2>
          {room.history.map((record) => (
            <article key={record.round}>
              <h3>第 {record.round} 回合</h3>
              <p>{record.narration}</p>
            </article>
          ))}

          {room.choices.length === 0 ? (
            <>
              {room.aiStatus === 'pending' && <p>AI 正在生成开场…</p>}
              {room.aiStatus === 'error' && (
                <>
                  <p role="alert">{room.aiError}</p>
                  <button onClick={() => post('/retry')}>重试生成开场</button>
                </>
              )}
            </>
          ) : (
            <>
              <p><strong>{room.scene}</strong></p>
              <p>{room.narration}</p>
              {room.aiStatus === 'pending' && <p>AI 正在推进剧情，已提交的内容不会丢失…</p>}
              {room.aiStatus === 'error' && (
                <>
                  <p role="alert">{room.aiError}</p>
                  <button onClick={() => post('/retry')}>重试推进剧情</button>
                </>
              )}

              {submitted ? (
                <p>
                  你已提交「{room.choices.find((item) => item.id === submitted.choiceId)?.title ?? submitted.choiceId}
                  」{submitted.text && `：${submitted.text}`}，等待对方…
                </p>
              ) : !room.players[playerId] ? (
                <p role="alert">当前浏览器没有本房间的玩家身份，请回首页重新加入。</p>
              ) : room.aiStatus === 'idle' ? (
                <div>
                  <div>
                    {room.choices.map((choice) => (
                      <button key={choice.id} onClick={() => setChoiceId(choice.id)}>
                        {choice.title}
                      </button>
                    ))}
                  </div>
                  <textarea
                    maxLength={120}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="一句行动或台词（可选，最多 120 字）"
                  />
                  <button disabled={!choiceId} onClick={() => post('/turn', {playerId, choiceId, text})}>
                    提交
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      )}

      {room.state === 'finished' && (
        <section>
          <h2>故事结束</h2>
          <p>{room.endingReason}</p>
          <button onClick={() => router.push(`/room/${code}/report`)}>查看共同总结</button>
        </section>
      )}

      {error && <p role="alert">{error}</p>}
    </main>
  )
}
