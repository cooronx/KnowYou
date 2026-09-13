import {cookies} from 'next/headers'
import {NextResponse} from 'next/server'
import {SESSION_COOKIE, readSession} from '@/lib/auth-session'

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const user = await readSession(token)
  // 只返回展示所需字段，不下发 OAuth token
  return NextResponse.json({user: user ?? null})
}
