import {useCallback, useEffect, useState} from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {api} from '@/lib/api'
import {MAX_ROUNDS, story, type Room} from '@/types'

export default function RoomPage() {
  const {code = ''} = useParams()
  const navigate = useNavigate()
  const [room, setRoom] = useState<Room | null>(null)
  const [playerId, setPlayerId] = useState('')
  const [choiceId, setChoiceId] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setRoom(await api.getRoom(code))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '加载失败')
    }
  }, [code])

  useEffect(() => {
    setPlayerId(localStorage.getItem('playerId') ?? '')
    void load()
    const timer = setInterval(() => {
      void load()
    }, 1500)
    return () => clearInterval(timer)
  }, [load])

  async function post(action: (code: string) => Promise<Room>): Promise<void> {
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

  if (!room) return <p className="text-sm text-muted-foreground">{error || '加载中…'}</p>

  const submitted = room.submissions[playerId]
  const me = room.players[playerId]
  const myCharacter = story.characters.find((character) => character.id === me?.role)

  return (
    <main className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-bold">{story.title}</h1>
        <p className="text-sm text-muted-foreground">游客演示版 · 固定测试故事 · 测试房间，重启后失效</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>玩家</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <ul className="grid gap-1 text-sm">
            {room.playerIds.map((id) => {
              const player = room.players[id]
              const character = story.characters.find((item) => item.id === player.role)
              return (
                <li key={id}>
                  {player.name}：{character?.name}
                  {id === playerId && '（你）'}
                </li>
              )
            })}
          </ul>
          {me && myCharacter ? (
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium">你扮演：{myCharacter.name}</p>
              <p>目标：{myCharacter.goal}</p>
              <p>性格：{myCharacter.traits}</p>
            </div>
          ) : (
            <p role="alert" className="text-sm text-destructive">
              当前浏览器没有本房间的玩家身份，请回首页重新加入。
            </p>
          )}
        </CardContent>
      </Card>

      {room.state === 'waiting' && (
        <Card>
          <CardHeader>
            <CardTitle>等待玩家（{room.playerIds.length}/2）</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {room.playerIds.length < 2 && <p className="text-sm text-muted-foreground">让同伴打开同一页面点「加入房间」。</p>}
            <p className="text-sm">{story.summary}</p>
            <div>
              <h3 className="text-sm font-medium">开场</h3>
              <p className="text-sm text-muted-foreground">{story.opening}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium">角色卡</h3>
              <ul className="grid gap-1 text-sm text-muted-foreground">
                {story.characters.map((character) => {
                  const ownerId = room.playerIds.find((id) => room.players[id].role === character.id)
                  return (
                    <li key={character.id}>
                      {character.name}：目标「{character.goal}」，性格：{character.traits}
                      {ownerId ? `（${room.players[ownerId].name} 扮演）` : '（待玩家加入）'}
                    </li>
                  )
                })}
              </ul>
            </div>
            <Button
              className="w-fit"
              disabled={room.playerIds.length !== 2}
              onClick={() => post((value) => api.startRoom(value))}
            >
              开始游戏
            </Button>
          </CardContent>
        </Card>
      )}

      {room.state === 'playing' && (
        <Card>
          <CardHeader>
            <CardTitle>
              第 {room.round}/{MAX_ROUNDS} 回合
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {room.history.map((record) => (
              <article key={record.round} className="grid gap-1">
                <h3 className="text-sm font-medium">第 {record.round} 回合</h3>
                <p className="text-sm text-muted-foreground">{record.narration}</p>
              </article>
            ))}

            {room.choices.length === 0 ? (
              <>
                {room.aiStatus === 'pending' && <p className="text-sm text-muted-foreground">AI 正在生成开场…</p>}
                {room.aiStatus === 'error' && (
                  <>
                    <p role="alert" className="text-sm text-destructive">
                      {room.aiError}
                    </p>
                    <Button className="w-fit" onClick={() => post((value) => api.retry(value))}>
                      重试生成开场
                    </Button>
                  </>
                )}
              </>
            ) : (
              <>
                <p className="font-medium">{room.scene}</p>
                <p className="text-sm">{room.narration}</p>
                {room.aiStatus === 'pending' && (
                  <p className="text-sm text-muted-foreground">AI 正在推进剧情，已提交的内容不会丢失…</p>
                )}
                {room.aiStatus === 'error' && (
                  <>
                    <p role="alert" className="text-sm text-destructive">
                      {room.aiError}
                    </p>
                    <Button className="w-fit" onClick={() => post((value) => api.retry(value))}>
                      重试推进剧情
                    </Button>
                  </>
                )}

                {submitted ? (
                  <p className="text-sm text-muted-foreground">
                    你已提交「{room.choices.find((item) => item.id === submitted.choiceId)?.title ?? submitted.choiceId}
                    」{submitted.text && `：${submitted.text}`}，等待对方…
                  </p>
                ) : !room.players[playerId] ? (
                  <p role="alert" className="text-sm text-destructive">
                    当前浏览器没有本房间的玩家身份，请回首页重新加入。
                  </p>
                ) : room.aiStatus === 'idle' ? (
                  <div className="grid gap-3">
                    <div className="flex flex-wrap gap-2">
                      {room.choices.map((choice) => (
                        <Button
                          key={choice.id}
                          variant={choiceId === choice.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setChoiceId(choice.id)}
                        >
                          {choice.title}
                        </Button>
                      ))}
                    </div>
                    <textarea
                      maxLength={120}
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      placeholder="一句行动或台词（可选，最多 120 字）"
                      className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <Button
                      className="w-fit"
                      disabled={!choiceId}
                      onClick={() => post((value) => api.submitTurn(value, {playerId, choiceId, text}))}
                    >
                      提交
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {room.state === 'finished' && (
        <Card>
          <CardHeader>
            <CardTitle>故事结束</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm">{room.endingReason}</p>
            <Button className="w-fit" onClick={() => navigate(`/room/${code}/report`)}>
              查看共同总结
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </main>
  )
}
