import {NextResponse} from 'next/server'
import {getRoom} from '@/lib/room-store'

export async function GET(_request: Request, {params}: {params: Promise<{code: string}>}) {
  const room = getRoom((await params).code)
  if (!room) return NextResponse.json({error: '房间不存在'}, {status: 404})
  return NextResponse.json(room)
}
