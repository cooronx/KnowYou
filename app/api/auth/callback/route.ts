import {cookies} from 'next/headers'
import {NextResponse} from 'next/server'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  STATE_COOKIE,
  consumeOauthState,
  createSession,
  sessionCookieOptions,
} from '@/lib/auth-session'
import {exchangeToken, fetchUserProfile, oauthConfig, readCallbackCode} from '@/lib/zhihu-oauth'

/** 失败时跳回首页并带一个粗粒度原因，不把内部错误细节写进 URL */
function failure(request: Request, reason: string): NextResponse {
  const target = new URL('/', request.url)
  target.searchParams.set('login', reason)
  const response = NextResponse.redirect(target)
  // 一次性凭据，无论成败都清理
  response.cookies.set(STATE_COOKIE, '', sessionCookieOptions(0))
  return response
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams

  const code = readCallbackCode(params)
  if (!code) return failure(request, 'no_code')

  // 校验 state 与本浏览器 Cookie 一致并原子消费，通过后才交换 token
  const state = params.get('state') ?? ''
  const cookieState = (await cookies()).get(STATE_COOKIE)?.value
  if (!(await consumeOauthState(state, cookieState))) return failure(request, 'state_invalid')

  try {
    const config = oauthConfig()
    const token = await exchangeToken(config, code)
    const profile = await fetchUserProfile(token.accessToken)
    const {token: sessionToken} = await createSession(profile, token)

    const response = NextResponse.redirect(new URL('/', request.url))
    response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions(SESSION_MAX_AGE_SECONDS))
    response.cookies.set(STATE_COOKIE, '', sessionCookieOptions(0))
    return response
  } catch (error) {
    console.error('[auth] 知乎登录失败：', error)
    return failure(request, 'failed')
  }
}
