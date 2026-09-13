import {NextResponse} from 'next/server'
import {roomRepository} from '@/lib/room-repository-server'
import {create} from '@/lib/room-store'

export async function POST() {
  try {
    const {room, playerId} = await create(roomRepository)
    return NextResponse.json({code: room.code, playerId})
  } catch (error) {
    return NextResponse.json({error: error instanceof Error ? error.message : '加入失败'}, {status: 400})
  }
}
