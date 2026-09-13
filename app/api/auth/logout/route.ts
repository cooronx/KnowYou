import {cookies} from 'next/headers'
import {NextResponse} from 'next/server'
import {SESSION_COOKIE, destroySession, sessionCookieOptions} from '@/lib/auth-session'
import {getPrisma} from '@/lib/prisma'

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  await destroySession(getPrisma(), token)
  const response = NextResponse.json({ok: true})
  // maxAge 0 立即失效，退出后不自动重新登录
  response.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0))
  return response
}
