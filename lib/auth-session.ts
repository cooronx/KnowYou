import {createHash, randomBytes, timingSafeEqual} from 'node:crypto'
import {getRdb, unwrap} from './rdb.ts'
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

type UserRow = {
  id: string
  zhihuUid: string
  fullname: string
  avatar: string
  headline: string
}

type SessionRow = {
  tokenHash: string
  userId: string
}

function randomToken(): string {
  // 密码学安全随机数，用于 state 与会话令牌
  return randomBytes(32).toString('base64url')
}

/** 会话令牌只存哈希：数据库泄露不足以直接伪造会话 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** 时间戳统一写 UTC ISO 字符串：与库中 timestamp 的字面值一致，比较不会受服务器时区影响 */
function isoFromNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString()
}

/** 生成并保存一次登录请求的 state，返回值放进授权 URL */
export async function createOauthState(): Promise<string> {
  const state = randomToken()
  await unwrap(
    getRdb()
      .from('OauthState')
      .insert([{state, expiresAt: isoFromNow(STATE_TTL_MS)}])
      .select(),
  )
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
 * 2. DELETE 影响行数为 1——并发重放时只有一个请求能删到行，其余为 0
 */
export async function consumeOauthState(
  state: string,
  cookieState: string | undefined,
): Promise<boolean> {
  if (!state || !cookieState) return false
  if (!sameValue(state, cookieState)) return false
  const now = isoFromNow(0)
  const consumed = await unwrap(
    getRdb().from('OauthState').delete().eq('state', state).gt('expiresAt', now).select(),
  )
  // 顺带清理过期记录，避免表无限增长
  await unwrap(getRdb().from('OauthState').delete().lte('expiresAt', now).select())
  return consumed.length === 1
}

/** 按 zhihuUid 更新资料；不存在则创建。并发首登撞唯一键时回退为读取 */
async function upsertUser(profile: ZhihuUserProfile): Promise<UserRow> {
  const rdb = getRdb()
  const fields = {
    hashId: profile.hashId,
    fullname: profile.fullname,
    avatar: profile.avatar,
    headline: profile.headline,
  }
  const existing = await unwrap<UserRow>(rdb.from('User').select('*').eq('zhihuUid', profile.zhihuUid))
  if (existing.length > 0) {
    const [updated] = await unwrap<UserRow>(
      rdb
        .from('User')
        .update({...fields, updatedAt: isoFromNow(0)})
        .eq('zhihuUid', profile.zhihuUid)
        .select(),
    )
    return updated
  }
  try {
    const [created] = await unwrap<UserRow>(
      rdb
        .from('User')
        .insert([{id: crypto.randomUUID(), zhihuUid: profile.zhihuUid, ...fields, updatedAt: isoFromNow(0)}])
        .select(),
    )
    return created
  } catch (error) {
    // 唯一键冲突说明另一并发请求刚创建了同一个用户，读取即可
    const [created] = await unwrap<UserRow>(rdb.from('User').select('*').eq('zhihuUid', profile.zhihuUid))
    if (!created) throw error
    return created
  }
}

/**
 * 建立登录会话，返回要写进 Cookie 的原始令牌。
 * OAuth token 留在服务端记录里，不下发浏览器。
 */
export async function createSession(
  profile: ZhihuUserProfile,
  oauth: {accessToken: string; expiresInSeconds: number},
): Promise<{token: string; user: SessionUser}> {
  const user = await upsertUser(profile)
  const token = randomToken()
  await unwrap(
    getRdb()
      .from('Session')
      .insert([
        {
          tokenHash: hashToken(token),
          userId: user.id,
          oauthAccessToken: oauth.accessToken,
          oauthTokenExpires: isoFromNow(oauth.expiresInSeconds * 1000),
          expiresAt: isoFromNow(SESSION_TTL_MS),
        },
      ])
      .select(),
  )
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
export async function readSession(token: string | undefined): Promise<SessionUser | undefined> {
  if (!token) return undefined
  const tokenHash = hashToken(token)
  const now = isoFromNow(0)
  // 过期判断放在查询条件里，避免把库里的 naive 时间戳拿到 JS 里按本地时区解析
  const sessions = await unwrap<SessionRow>(
    getRdb().from('Session').select('*').eq('tokenHash', tokenHash).gt('expiresAt', now),
  )
  if (sessions.length === 0) {
    await unwrap(
      getRdb().from('Session').delete().eq('tokenHash', tokenHash).lte('expiresAt', now).select(),
    ).catch(() => undefined)
    return undefined
  }
  const [user] = await unwrap<UserRow>(getRdb().from('User').select('*').eq('id', sessions[0].userId))
  if (!user) return undefined
  return {
    id: user.id,
    zhihuUid: user.zhihuUid,
    fullname: user.fullname,
    avatar: user.avatar,
    headline: user.headline,
  }
}

/** 退出登录：删除映射，不做自动重新登录 */
export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return
  await unwrap(getRdb().from('Session').delete().eq('tokenHash', hashToken(token)).select())
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
