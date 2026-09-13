import {NextResponse} from 'next/server'
import {openAiGameAi} from '@/lib/ai'
import {roomRepository} from '@/lib/room-repository-server'
import {retryAi} from '@/lib/room-store'

export async function POST(_request: Request, {params}: {params: Promise<{code: string}>}) {
  try {
    const room = await retryAi((await params).code, openAiGameAi, roomRepository)
    return NextResponse.json(room)
  } catch (error) {
    return NextResponse.json({error: error instanceof Error ? error.message : '重试失败'}, {status: 400})
  }
}
