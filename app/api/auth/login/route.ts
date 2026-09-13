import {NextResponse} from 'next/server'
import {STATE_COOKIE, STATE_MAX_AGE_SECONDS, createOauthState, sessionCookieOptions} from '@/lib/auth-session'
import {buildAuthorizeUrl, oauthConfig} from '@/lib/zhihu-oauth'

export async function GET() {
  let authorizeUrl: string
  let state: string
  try {
    const config = oauthConfig()
    state = await createOauthState()
    authorizeUrl = buildAuthorizeUrl(config, state)
  } catch (error) {
    // 配置缺失属于部署问题，返回消息但不含凭证内容
    return NextResponse.json(
      {error: error instanceof Error ? error.message : '无法发起知乎登录'},
      {status: 500},
    )
  }
  const response = NextResponse.redirect(authorizeUrl)
  // 把本次登录请求绑定到当前浏览器，回调时与 Query 的 state 比对
  response.cookies.set(STATE_COOKIE, state, sessionCookieOptions(STATE_MAX_AGE_SECONDS))
  return response
}
