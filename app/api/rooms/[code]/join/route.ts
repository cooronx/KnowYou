import {NextResponse} from 'next/server'
import {getRoom, join} from '@/lib/room-store'

export async function POST(request: Request, {params}: {params: Promise<{code: string}>}) {
  try {
    const room = getRoom((await params).code)
    if (!room) throw new Error('房间不存在')
    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name : ''
    const {playerId} = join(room, name)
    return NextResponse.json({code: room.code, playerId})
  } catch (error) {
    return NextResponse.json({error: error instanceof Error ? error.message : '加入失败'}, {status: 400})
  }
}
