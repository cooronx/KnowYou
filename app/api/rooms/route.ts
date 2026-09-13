import {NextResponse} from 'next/server'
import {create} from '@/lib/room-store'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name : ''
    const {room, playerId} = create(name)
    return NextResponse.json({code: room.code, playerId})
  } catch (error) {
    return NextResponse.json({error: error instanceof Error ? error.message : '创建失败'}, {status: 400})
  }
}
