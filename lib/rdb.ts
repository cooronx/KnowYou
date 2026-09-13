import cloudbase from '@cloudbase/node-sdk'

/**
 * CloudBase 数据通道（PostgREST over HTTP）。
 *
 * 服务端不再直连 PostgreSQL，而是用环境 API Key 走平台 HTTP 接口：
 * 部署时只需要 CLOUDBASE_ENV_ID + CLOUDBASE_API_KEY，不需要数据库连接串。
 */

type RdbError = {message: string; code?: string}
type RdbResponse = {data: unknown[] | null; error: RdbError | null}

/** node-sdk 的 rdb() 没有类型声明，这里按实际用到的 PostgREST 查询链声明最小接口 */
export interface RdbQuery extends PromiseLike<RdbResponse> {
  select(columns?: string): RdbQuery
  eq(column: string, value: unknown): RdbQuery
  gt(column: string, value: unknown): RdbQuery
  lte(column: string, value: unknown): RdbQuery
  order(column: string, options?: {ascending?: boolean}): RdbQuery
  limit(count: number): RdbQuery
}

export interface RdbClient {
  from(table: string): {
    select(columns?: string): RdbQuery
    insert(rows: Record<string, unknown>[]): RdbQuery
    upsert(rows: Record<string, unknown>[], options?: {onConflict?: string}): RdbQuery
    update(patch: Record<string, unknown>): RdbQuery
    delete(): RdbQuery
  }
}

function rdbConfig(): {envId: string; apiKey: string} {
  const envId = process.env.CLOUDBASE_ENV_ID?.trim()
  const apiKey = process.env.CLOUDBASE_API_KEY?.trim()
  if (!envId || !apiKey) {
    throw new Error('云开发未配置：请在 .env 中设置 CLOUDBASE_ENV_ID 与 CLOUDBASE_API_KEY')
  }
  return {envId, apiKey}
}

let client: RdbClient | undefined

/** 延迟创建客户端：模块加载期不校验环境变量，避免未配置时 next build 直接失败 */
export function getRdb(): RdbClient {
  if (!client) {
    const {envId, apiKey} = rdbConfig()
    const app = cloudbase.init({env: envId, accessKey: apiKey})
    // rdb 默认把 Accept-Profile 设成 envId 会 406，必须显式指定 public schema
    client = (app as unknown as {rdb(options: {database: string}): RdbClient}).rdb({
      database: 'public',
    })
  }
  return client
}

/** 统一解包 {data, error}：错误抛异常，无数据返回空数组 */
export async function unwrap<T>(query: PromiseLike<RdbResponse>): Promise<T[]> {
  const {data, error} = await query
  if (error) throw new Error(`数据库请求失败：${error.message}`)
  return (data ?? []) as T[]
}

/**
 * 调用 PG 函数（PostgREST RPC）。
 * node-sdk 的 rdb() 只暴露 from()，所以这里直接请求同一网关的 RPC 路径。
 */
export async function callRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const {envId, apiKey} = rdbConfig()
  const response = await fetch(`https://${envId}.api.tcloudbasegateway.com/v1/rdb/rest/rpc/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'X-Db-Instance': 'default',
      'Accept-Profile': 'public',
      'Content-Profile': 'public',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  })
  if (!response.ok) throw new Error(`RPC ${name} 失败：HTTP ${response.status}`)
  // 无返回值的函数（如 ensure_room）是 204，空 body 不能直接 json()
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}
