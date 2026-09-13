import {Injectable} from '@nestjs/common'
import {
  consumeOauthState,
  createOauthState,
  createSession,
  destroySession,
  readSession,
  type SessionUser,
} from '../../auth-session.ts'
import {buildAuthorizeUrl, exchangeToken, fetchUserProfile, oauthConfig} from '../../zhihu-oauth.ts'
import {PrismaService} from '../prisma/prisma.service.ts'

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /** 生成 state 与授权地址；appKey 只在服务端用于后续换 token */
  async startLogin(): Promise<{url: string; state: string}> {
    const state = await createOauthState(this.prisma.client)
    const url = buildAuthorizeUrl(oauthConfig(), state)
    return {url, state}
  }

  consumeState(state: string, cookieState: string | undefined): Promise<boolean> {
    return consumeOauthState(this.prisma.client, state, cookieState)
  }

  /** 交换 token、读取资料并建立会话，返回要写入 Cookie 的会话令牌 */
  async completeLogin(code: string): Promise<string> {
    const token = await exchangeToken(oauthConfig(), code)
    const profile = await fetchUserProfile(token.accessToken)
    const {token: sessionToken} = await createSession(this.prisma.client, profile, token)
    return sessionToken
  }

  readSession(token: string | undefined): Promise<SessionUser | undefined> {
    return readSession(this.prisma.client, token)
  }

  destroySession(token: string | undefined): Promise<void> {
    return destroySession(this.prisma.client, token)
  }
}
