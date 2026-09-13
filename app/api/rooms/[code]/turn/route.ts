import {NextResponse} from 'next/server'
import {openAiGameAi} from '@/lib/ai'
import {roomRepository} from '@/lib/room-repository-server'
import {submitTurn} from '@/lib/room-store'

export async function POST(request: Request, {params}: {params: Promise<{code: string}>}) {
  try {
    const body = await request.json().catch(() => ({}))
    if (typeof body.playerId !== 'string' || typeof body.choiceId !== 'string') {
      throw new Error('请求缺少 playerId 或 choiceId')
    }
    const room = await submitTurn(
      (await params).code,
      body.playerId,
      {choiceId: body.choiceId, text: typeof body.text === 'string' ? body.text : ''},
      openAiGameAi,
      roomRepository,
    )
    return NextResponse.json(room)
  } catch (error) {
    return NextResponse.json({error: error instanceof Error ? error.message : '提交失败'}, {status: 400})
  }
}
