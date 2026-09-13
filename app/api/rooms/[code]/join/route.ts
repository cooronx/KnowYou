import {NextResponse} from 'next/server'
import {roomRepository} from '@/lib/room-repository-server'
import {join} from '@/lib/room-store'

export async function POST(_request: Request, {params}: {params: Promise<{code: string}>}) {
  try {
    const {room, playerId} = await join((await params).code, roomRepository)
    return NextResponse.json({code: room.code, playerId})
  } catch (error) {
    return NextResponse.json({error: error instanceof Error ? error.message : '加入失败'}, {status: 400})
  }
}
