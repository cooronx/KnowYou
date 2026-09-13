import {NextResponse} from 'next/server'
import {openAiGameAi} from '@/lib/ai'
import {getRoom, retryAi} from '@/lib/room-store'

export async function POST(_request: Request, {params}: {params: Promise<{code: string}>}) {
  const room = getRoom((await params).code)
  if (!room) return NextResponse.json({error: '房间不存在'}, {status: 404})
  await retryAi(room, openAiGameAi)
  return NextResponse.json(room)
}
