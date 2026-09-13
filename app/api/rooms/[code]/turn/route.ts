import {NextResponse} from 'next/server'
import {openAiGameAi} from '@/lib/ai'
import {getRoom, submitTurn} from '@/lib/room-store'

export async function POST(request: Request, {params}: {params: Promise<{code: string}>}) {
  const room = getRoom((await params).code)
  if (!room) return NextResponse.json({error: '房间不存在'}, {status: 404})
  try {
    const body = await request.json().catch(() => ({}))
    if (typeof body.playerId !== 'string' || typeof body.choiceId !== 'string') {
      throw new Error('请求缺少 playerId 或 choiceId')
    }
    await submitTurn(
      room,
      body.playerId,
      {choiceId: body.choiceId, text: typeof body.text === 'string' ? body.text : ''},
      openAiGameAi,
    )
  } catch (error) {
    return NextResponse.json({error: error instanceof Error ? error.message : '提交失败'}, {status: 400})
  }
  return NextResponse.json(room)
}
