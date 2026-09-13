import {createHash, randomBytes, timingSafeEqual} from 'node:crypto'
import type {PrismaClient} from '@prisma/client'
import type {ZhihuUserProfile} from './zhihu-oauth.ts'

export const SESSION_COOKIE = 'knowyou_session'
export const STATE_COOKIE = 'knowyou_oauth_state'
const STATE_TTL_MS = 10 * 60 * 1000
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type SessionUser = {
  id: string
  zhihuUid: string
  fullname: string
  avatar: string
  headline: string
}

function randomToken(): string {
  // 密码学安全随机数，用于 state 与会话令牌
  return randomBytes(32).toString('base64url')
}

/** 会话令牌只存哈希：数据库泄露不足以直接伪造会话 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** 生成并保存一次登录请求的 state，返回值放进授权 URL */
export async function createOauthState(prisma: PrismaClient): Promise<string> {
  const state = randomToken()
  await prisma.oauthState.create({data: {state, expiresAt: new Date(Date.now() + STATE_TTL_MS)}})
  return state
}

/** 定长比较，避免按字节短路泄露信息 */
function sameValue(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * 校验并原子消费 state。
 *
 * 两道校验都必须通过：
 * 1. 回调 Query 的 state 与发起登录时写入该浏览器的 Cookie 一致——把登录请求绑定到
 *    这个浏览器会话，另一个浏览器无法复用他人的登录请求（CSRF 防护）
 * 2. deleteMany 影响行数为 1——并发重放时只有一个请求能拿到 1，其余为 0
 */
export async function consumeOauthState(
  prisma: PrismaClient,
  state: string,
  cookieState: string | undefined,
): Promise<boolean> {
  if (!state || !cookieState) return false
  if (!sameValue(state, cookieState)) return false
  const {count} = await prisma.oauthState.deleteMany({where: {state, expiresAt: {gt: new Date()}}})
  // 顺带清理过期记录，避免表无限增长
  await prisma.oauthState.deleteMany({where: {expiresAt: {lte: new Date()}}})
  return count === 1
}

/**
 * 建立登录会话，返回要写进 Cookie 的原始令牌。
 * OAuth token 留在服务端记录里，不下发浏览器。
 */
export async function createSession(
  prisma: PrismaClient,
  profile: ZhihuUserProfile,
  oauth: {accessToken: string; expiresInSeconds: number},
): Promise<{token: string; user: SessionUser}> {
  const user = await prisma.user.upsert({
    where: {zhihuUid: profile.zhihuUid},
    create: {
      zhihuUid: profile.zhihuUid,
      hashId: profile.hashId,
      fullname: profile.fullname,
      avatar: profile.avatar,
      headline: profile.headline,
    },
    update: {
      hashId: profile.hashId,
      fullname: profile.fullname,
      avatar: profile.avatar,
      headline: profile.headline,
    },
  })
  const token = randomToken()
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      oauthAccessToken: oauth.accessToken,
      oauthTokenExpires: new Date(Date.now() + oauth.expiresInSeconds * 1000),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  })
  return {
    token,
    user: {
      id: user.id,
      zhihuUid: user.zhihuUid,
      fullname: user.fullname,
      avatar: user.avatar,
      headline: user.headline,
    },
  }
}

/** 读取当前会话用户；令牌无效或会话过期返回 undefined */
export async function readSession(
  prisma: PrismaClient,
  token: string | undefined,
): Promise<SessionUser | undefined> {
  if (!token) return undefined
  const session = await prisma.session.findUnique({
    where: {tokenHash: hashToken(token)},
    include: {user: true},
  })
  if (!session) return undefined
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({where: {tokenHash: session.tokenHash}}).catch(() => undefined)
    return undefined
  }
  return {
    id: session.user.id,
    zhihuUid: session.user.zhihuUid,
    fullname: session.user.fullname,
    avatar: session.user.avatar,
    headline: session.user.headline,
  }
}

/** 退出登录：删除映射，不做自动重新登录 */
export async function destroySession(prisma: PrismaClient, token: string | undefined): Promise<void> {
  if (!token) return
  await prisma.session.deleteMany({where: {tokenHash: hashToken(token)}})
}

/** Cookie 属性：HttpOnly 防脚本读取，SameSite=Lax 允许 OAuth 回调跳转携带 */
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    // 本地开发走 http，生产必须 Secure
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  }
}

export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000
export const STATE_MAX_AGE_SECONDS = STATE_TTL_MS / 1000
