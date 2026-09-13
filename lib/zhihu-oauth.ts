/**
 * 知乎黑客松 OAuth 客户端。
 *
 * 协议要点（来自开放平台文档与 2026-05-14 线上实测）：
 * - 授权回调参数是 authorization_code，不是 code；换 token 时表单字段才叫 code
 * - 业务字段 code: 20000 表示成功，不能把所有非零 code 当失败
 * - 只返回 access_token 与 expires_in，没有 refresh token，过期需重新授权
 */

const AUTHORIZE_URL = 'https://openapi.zhihu.com/authorize'
const TOKEN_URL = 'https://openapi.zhihu.com/access_token'
const USER_URL = 'https://openapi.zhihu.com/user'
const REQUEST_TIMEOUT_MS = 15_000

export type ZhihuTokenResult = {
  accessToken: string
  expiresInSeconds: number
}

export type ZhihuUserProfile = {
  /** 知乎 uid 为 int64，全程以字符串传递，避免 JS 精度丢失 */
  zhihuUid: string
  hashId: string
  fullname: string
  avatar: string
  headline: string
}

export type OauthConfig = {
  appId: string
  appKey: string
  redirectUri: string
}

/** 读取 OAuth 配置。appKey 只在服务端使用，调用方不得回传给浏览器 */
export function oauthConfig(): OauthConfig {
  const appId = process.env.ZHIHU_OAUTH_APP_ID?.trim()
  const appKey = process.env.ZHIHU_OAUTH_APP_KEY?.trim()
  const redirectUri = process.env.ZHIHU_OAUTH_REDIRECT_URI?.trim()
  if (!appId || !appKey || !redirectUri) {
    throw new Error(
      '知乎登录未配置：请在 .env 中设置 ZHIHU_OAUTH_APP_ID、ZHIHU_OAUTH_APP_KEY、ZHIHU_OAUTH_REDIRECT_URI',
    )
  }
  return {appId, appKey, redirectUri}
}

/**
 * 构造授权页地址。redirect_uri 必须与赛事页面登记值逐字符一致，
 * 且与换取 token 时提交的地址相同。
 */
export function buildAuthorizeUrl(config: OauthConfig, state: string): string {
  const url = new URL(AUTHORIZE_URL)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('app_id', config.appId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)
  return url.toString()
}

/** 回调参数以 authorization_code 为主路径，同时兼容可能的协议修订 code */
export function readCallbackCode(params: URLSearchParams): string | undefined {
  const value = params.get('authorization_code') ?? params.get('code')
  const code = value?.trim()
  return code ? code : undefined
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, {...init, signal: controller.signal})
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('知乎接口请求超时，请重试')
    }
    throw new Error('知乎接口请求失败，请检查网络')
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 业务错误判定：文档明确 20000 表示成功，且要求优先检查目标字段是否存在，
 * 所以只在缺少目标字段时才拿 code 判错。
 */
function businessError(data: Record<string, unknown>): string | undefined {
  const code = data.code
  if (typeof code !== 'number' || code === 20000) return undefined
  const detail = typeof data.data === 'string' ? data.data : typeof data.message === 'string' ? data.message : ''
  return detail ? `知乎接口返回错误（${code}）：${detail}` : `知乎接口返回错误（${code}）`
}

export async function exchangeToken(config: OauthConfig, code: string): Promise<ZhihuTokenResult> {
  const response = await fetchWithTimeout(TOKEN_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      app_id: config.appId,
      app_key: config.appKey,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
      code,
    }).toString(),
  })
  const text = await response.text()
  if (!response.ok) {
    // 不回显响应体：可能包含凭证相关信息
    throw new Error(`知乎换取 token 失败（HTTP ${response.status}）`)
  }
  let data: Record<string, unknown>
  try {
    data = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error('知乎换取 token 返回的不是合法 JSON')
  }
  const accessToken = typeof data.access_token === 'string' ? data.access_token.trim() : ''
  if (!accessToken) {
    throw new Error(businessError(data) ?? '知乎未返回 access_token')
  }
  const expiresIn = typeof data.expires_in === 'number' && data.expires_in > 0 ? data.expires_in : 3600
  return {accessToken, expiresInSeconds: expiresIn}
}

/**
 * 从原始 JSON 文本中无损提取 uid。
 * uid 是 int64（如 969570047710216200），先 JSON.parse 再转字符串会丢精度，
 * 因此必须在解析前直接从文本取数字字面量。
 */
export function extractUid(rawText: string): string | undefined {
  const match = /"uid"\s*:\s*"?(\d+)"?/.exec(rawText)
  return match?.[1]
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** 解析 /user 响应。email 与 phone_no 不读取、不存储 */
export function parseUserProfile(rawText: string): ZhihuUserProfile {
  let data: Record<string, unknown>
  try {
    data = JSON.parse(rawText) as Record<string, unknown>
  } catch {
    throw new Error('知乎用户信息返回的不是合法 JSON')
  }
  // 只用文本提取的 uid，忽略 JSON.parse 得到的有损数值
  const zhihuUid = extractUid(rawText)
  if (!zhihuUid) {
    throw new Error(businessError(data) ?? '知乎未返回有效的用户标识')
  }
  return {
    zhihuUid,
    hashId: asTrimmedString(data.hash_id),
    fullname: asTrimmedString(data.fullname),
    avatar: asTrimmedString(data.avatar_path),
    headline: asTrimmedString(data.headline),
  }
}

export async function fetchUserProfile(accessToken: string): Promise<ZhihuUserProfile> {
  const response = await fetchWithTimeout(USER_URL, {
    headers: {Authorization: `Bearer ${accessToken}`},
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`获取知乎用户信息失败（HTTP ${response.status}）`)
  }
  return parseUserProfile(text)
}
