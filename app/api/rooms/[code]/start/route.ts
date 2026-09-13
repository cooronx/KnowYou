import {NextResponse} from 'next/server'
import {openAiGameAi} from '@/lib/ai'
import {roomRepository} from '@/lib/room-repository-server'
import {startGame} from '@/lib/room-store'

export async function POST(_request: Request, {params}: {params: Promise<{code: string}>}) {
  try {
    const room = await startGame((await params).code, openAiGameAi, roomRepository)
    return NextResponse.json(room)
  } catch (error) {
    return NextResponse.json({error: error instanceof Error ? error.message : '开始失败'}, {status: 400})
  }
}
