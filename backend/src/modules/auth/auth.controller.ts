import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import type {Request, Response} from 'express'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  STATE_COOKIE,
  STATE_MAX_AGE_SECONDS,
  sessionCookieOptions,
} from '../../auth-session.ts'
import {readCallbackCode} from '../../zhihu-oauth.ts'
import {AuthService} from './auth.service.ts'

/** Next 的 cookie maxAge 以秒计，Express 的 res.cookie 以毫秒计 */
function cookieOptions(maxAgeSeconds: number) {
  const options = sessionCookieOptions(maxAgeSeconds)
  return {...options, maxAge: options.maxAge * 1000}
}

function webAppUrl(): string {
  return (process.env.WEB_APP_URL?.trim() || 'http://localhost:5173').replace(/\/+$/, '')
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('login')
  async login(@Res() res: Response): Promise<void> {
    let url: string
    let state: string
    try {
      ;({url, state} = await this.auth.startLogin())
    } catch (error) {
      throw new BadRequestException({
        error: error instanceof Error ? error.message : '无法发起知乎登录',
      })
    }
    // 把本次登录请求绑定到当前浏览器，回调时与 Query 的 state 比对
    res.cookie(STATE_COOKIE, state, cookieOptions(STATE_MAX_AGE_SECONDS))
    res.redirect(url)
  }

  @Get('callback')
  async callback(
    @Req() req: Request,
    @Query('state') state = '',
    @Query('authorization_code') authorizationCode: string | undefined,
    @Query('code') code: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const fail = (reason: string): void => {
      // 失败跳回前端首页并带粗粒度原因，不把内部细节写进 URL
      const target = new URL('/', webAppUrl())
      target.searchParams.set('login', reason)
      res.cookie(STATE_COOKIE, '', cookieOptions(0))
      res.redirect(target.toString())
    }

    const params = new URLSearchParams()
    if (authorizationCode) params.set('authorization_code', authorizationCode)
    if (code) params.set('code', code)
    const callbackCode = readCallbackCode(params)
    if (!callbackCode) {
      fail('no_code')
      return
    }

    const cookieState = req.cookies?.[STATE_COOKIE] as string | undefined
    if (!(await this.auth.consumeState(state, cookieState))) {
      fail('state_invalid')
      return
    }

    try {
      const sessionToken = await this.auth.completeLogin(callbackCode)
      res.cookie(SESSION_COOKIE, sessionToken, cookieOptions(SESSION_MAX_AGE_SECONDS))
      res.cookie(STATE_COOKIE, '', cookieOptions(0))
      res.redirect(`${webAppUrl()}/`)
    } catch (error) {
      console.error('[auth] 知乎登录失败：', error)
      fail('failed')
    }
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({passthrough: true}) res: Response): Promise<{ok: boolean}> {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined
    await this.auth.destroySession(token)
    // maxAge 0 立即失效，退出后不自动重新登录
    res.cookie(SESSION_COOKIE, '', cookieOptions(0))
    return {ok: true}
  }

  @Get('session')
  async session(@Req() req: Request): Promise<{user: unknown}> {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined
    const user = await this.auth.readSession(token)
    // 只返回展示所需字段，不下发 OAuth token
    return {user: user ?? null}
  }
}
