import {NextResponse} from 'next/server'
import {getRoom, join} from '@/lib/room-store'

export async function POST(_request: Request, {params}: {params: Promise<{code: string}>}) {
  try {
    const room = getRoom((await params).code)
    if (!room) throw new Error('房间不存在')
    const {playerId} = join(room)
    return NextResponse.json({code: room.code, playerId})
  } catch (error) {
    return NextResponse.json({error: error instanceof Error ? error.message : '加入失败'}, {status: 400})
  }
}
