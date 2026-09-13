import {useCallback, useEffect, useState} from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {api} from '@/lib/api'
import {story, type Room} from '@/types'

export default function ReportPage() {
  const {code = ''} = useParams()
  const navigate = useNavigate()
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setRoom(await api.getRoom(code))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '加载失败')
    }
  }, [code])

  useEffect(() => {
    void load()
  }, [load])

  async function retry(): Promise<void> {
    setError('')
    try {
      setRoom(await api.retry(code))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '生成失败')
      await load()
    }
  }

  if (!room) return <p className="text-sm text-muted-foreground">{error || '加载中…'}</p>

  const report = room.report

  return (
    <main className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-bold">共同总结</h1>
        <p className="text-sm text-muted-foreground">游客演示版 · 固定测试故事「走廊尽头的钥匙」</p>
      </header>

      {!report && room.aiStatus === 'pending' && <p className="text-sm text-muted-foreground">AI 正在生成总结…</p>}
      {!report && room.aiStatus === 'error' && (
        <div className="grid gap-2">
          <p role="alert" className="text-sm text-destructive">
            {room.aiError}
          </p>
          <Button className="w-fit" onClick={retry}>
            重试生成总结
          </Button>
        </div>
      )}
      {!report && room.aiStatus === 'idle' && room.state !== 'finished' && (
        <p className="text-sm text-muted-foreground">故事还没有结束，先回到房间完成回合。</p>
      )}

      {report && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>你们的共同点</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 text-sm">
                {report.common.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>你们的差异点</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 text-sm">
                {report.differences.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>互补点</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{report.complement}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>下次可以聊</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 text-sm">
                {report.topics.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>回合回放（总结的证据）</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {room.history.map((record) => (
            <article key={record.round} className="grid gap-1">
              <h3 className="text-sm font-medium">第 {record.round} 回合</h3>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {record.entries.map((entry) => {
                  const character = story.characters.find((item) => item.id === entry.role)
                  return (
                    <li key={entry.playerId}>
                      {entry.name}（{character?.name ?? `角色 ${entry.role}`}）选择了「{entry.choiceTitle}」
                      {entry.text && `，${entry.text}`}
                    </li>
                  )
                })}
              </ul>
              <p className="text-sm text-muted-foreground">{record.narration}</p>
            </article>
          ))}
        </CardContent>
      </Card>

      <Button
        variant="outline"
        className="w-fit"
        onClick={() => {
          localStorage.removeItem('playerId')
          navigate('/')
        }}
      >
        再来一局
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </main>
  )
}
