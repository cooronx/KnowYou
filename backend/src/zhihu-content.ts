/**
 * 知乎黑客松活动内容客户端（无需鉴权）。
 *
 * 来源于开放平台资料，接口仅用于本次赛事，不应视为长期稳定的通用内容 API。
 * work_id 为 int64，接口以字符串返回，解析后仍以 string 传递。
 */
import type {SeedDetail, SeedSummary} from './seed-types.ts'

const CONTENT_BASE_URL = (
  process.env.ZHIHU_CONTENT_BASE_URL?.trim() || 'https://api.zhihu.com/km-indep-home/hackathon/v2'
).replace(/\/+$/, '')
const REQUEST_TIMEOUT_MS = 15_000

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim())
}

async function fetchJson(path: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${CONTENT_BASE_URL}${path}`, {
      headers: {Accept: 'application/json'},
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('知乎内容接口请求超时')
    }
    throw new Error('知乎内容接口请求失败，请检查网络')
  } finally {
    clearTimeout(timer)
  }
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`知乎内容接口失败（HTTP ${response.status}）`)
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('知乎内容接口返回的不是合法 JSON')
  }
}

/** 解析故事列表；字段缺失时保留空值，不猜测、不补造 */
export function parseStoryList(raw: unknown): SeedSummary[] {
  if (!Array.isArray(raw)) throw new Error('知乎故事列表格式错误')
  const summaries: SeedSummary[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const workId = asString(row.work_id)
    if (!workId) continue
    summaries.push({
      workId,
      title: asString(row.title),
      labels: asStringList(row.labels),
      description: asString(row.description),
      artwork: asString(row.artwork),
    })
  }
  return summaries
}

export async function fetchStoryList(): Promise<SeedSummary[]> {
  return parseStoryList(await fetchJson('/story/list'))
}

/** 解析故事详情；正文与作者署名按需拉取 */
export function parseStoryDetail(raw: unknown, workId: string): SeedDetail | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  return {
    workId,
    title: asString(row.chapter_name) || asString(row.title),
    labels: asStringList(row.labels),
    introduction: asString(row.introduction),
    authorName: asString(row.author_name),
    authorAvatar: asString(row.author_avatar),
    content: asString(row.content),
  }
}

export async function fetchStoryDetail(workId: string): Promise<SeedDetail | null> {
  const id = workId.trim()
  if (!id) return null
  // 作为单一路径段编码，避免 work_id 中的特殊字符改变请求路径
  return parseStoryDetail(await fetchJson(`/story/${encodeURIComponent(id)}`), id)
}
