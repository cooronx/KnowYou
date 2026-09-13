import type {AdvanceInput, GameAi, Report, SceneResult, SummaryInput} from './room-types.ts'
import type {StoryOutline} from './story.ts'

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-4o-mini'
const REQUEST_TIMEOUT_MS = 35_000

type ChatMessage = {role: 'system' | 'user'; content: string}

function aiConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('AI 未配置：请在 .env.local 中设置 OPENAI_API_KEY')
  return {
    apiKey,
    baseUrl: (process.env.OPENAI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
  }
}

async function chatJson(messages: ChatMessage[]): Promise<unknown> {
  const {apiKey, baseUrl, model} = aiConfig()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`},
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.8,
        response_format: {type: 'json_object'},
      }),
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[ai] 请求超时')
      throw new Error('AI 请求超时，请重试')
    }
    console.error('[ai] 请求失败：', error)
    const code = error instanceof Error ? (error.cause as {code?: string} | undefined)?.code : undefined
    throw new Error(
      code ? `AI 请求失败（网络错误 ${code}），请检查网络或接口地址` : 'AI 请求失败，请检查网络或接口地址',
    )
  } finally {
    clearTimeout(timer)
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).trim().slice(0, 200)
    console.error(`[ai] HTTP ${response.status}：${detail}`)
    throw new Error(
      detail
        ? `AI 请求失败（HTTP ${response.status}）：${detail}`
        : `AI 请求失败（HTTP ${response.status}），请重试`,
    )
  }
  const data = await response.json().catch(() => null)
  const rawContent = (
    data as {choices?: {message?: {content?: unknown}}[]} | null
  )?.choices?.[0]?.message?.content
  const content = typeof rawContent === 'string'
    ? rawContent
    : Array.isArray(rawContent)
      ? rawContent
          .map((part) => (typeof (part as {text?: unknown})?.text === 'string' ? (part as {text: string}).text : ''))
          .join('')
      : ''
  if (!content.trim()) throw new Error('AI 未返回内容，请重试')
  return parseJsonContent(content)
}

function parseJsonContent(content: string): unknown {
  // 部分 OpenAI 兼容服务即使开启 JSON 模式也会用 Markdown 代码块包裹返回
  const normalized = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  try {
    return JSON.parse(normalized)
  } catch {
    console.error('[ai] 返回值不是合法 JSON：', content.slice(0, 300))
    throw new Error('AI 返回不是合法 JSON，请重试')
  }
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`AI 返回缺少字段：${field}`)
  return value.trim()
}

function parseScene(raw: unknown, requireChoices: boolean): SceneResult {
  if (!raw || typeof raw !== 'object') throw new Error('AI 返回格式错误，请重试')
  const data = raw as Record<string, unknown>
  const isEnding = data.isEnding === true
  const choicesRaw = Array.isArray(data.choices) ? data.choices : []
  const choices = choicesRaw.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error('AI 返回的选择格式错误，请重试')
    const choice = item as Record<string, unknown>
    const id =
      typeof choice.id === 'string' && choice.id.trim()
        ? choice.id.trim()
        : String.fromCharCode(97 + index)
    return {id, title: asString(choice.title, `choices[${index}].title`)}
  })
  if ((requireChoices || !isEnding) && choices.length !== 2) {
    throw new Error('AI 必须返回 2 个选择，请重试')
  }
  if (new Set(choices.map((choice) => choice.id)).size !== choices.length) {
    throw new Error('AI 返回的选择 id 重复，请重试')
  }
  return {
    narration: asString(data.narration, 'narration'),
    scene: asString(data.scene, 'scene'),
    choices,
    isEnding,
    endingReason: typeof data.endingReason === 'string' ? data.endingReason.trim() : '',
  }
}

function parseStringList(value: unknown, count: number, field: string): string[] {
  if (!Array.isArray(value)) throw new Error(`AI 总结缺少字段：${field}`)
  const list = value
    .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    .map((item) => item.trim())
  if (list.length < count) throw new Error(`AI 总结的 ${field} 至少需要 ${count} 条，请重试`)
  return list.slice(0, count)
}

function parseReport(raw: unknown): Report {
  if (!raw || typeof raw !== 'object') throw new Error('AI 总结格式错误，请重试')
  const data = raw as Record<string, unknown>
  return {
    common: parseStringList(data.common, 3, 'common'),
    differences: parseStringList(data.differences, 2, 'differences'),
    complement: asString(data.complement, 'complement'),
    topics: parseStringList(data.topics, 3, 'topics'),
  }
}

const DIRECTOR_RULES = `你是一款双人互动故事的导演，两名玩家各自扮演一个角色，通过选择和价值取向不同的行动共同推进剧情。
写作要求：
- narration 是新的剧情文本，2-4 句，承接历史与双方本回合的选择/文字，不重复已有内容；
- scene 是当前场景的简短标题；
- choices 必须是 2 个价值取向明显不同的分支，id 只能使用 "a" 和 "b"，title 简短可直接点击；
- 不要评价玩家性格，不要输出 JSON 以外的任何内容。`

const SCENE_FORMAT = `请只输出一个 JSON 对象，格式为：
{"narration":"...","scene":"...","choices":[{"id":"a","title":"..."},{"id":"b","title":"..."}],"isEnding":false,"endingReason":""}`

function outlineText(outline: StoryOutline): string {
  const characters = outline.characters
    .map((character) => `- 角色 ${character.id}：${character.name}（目标：${character.goal}；性格：${character.traits}）`)
    .join('\n')
  return `标题：${outline.title}
简介：${outline.summary}
背景：${outline.setting}
核心冲突：${outline.premise}
开场：${outline.opening}
结尾方向：${outline.endingHint}
${characters}`
}

export const openAiGameAi: GameAi = {
  async revealOpening(outline) {
    const raw = await chatJson([
      {
        role: 'system',
        content: `${DIRECTOR_RULES}
这是故事的开场，请根据大纲和开场文本生成第一个场景与 2 个选择，isEnding 必须为 false。
${SCENE_FORMAT}`,
      },
      {role: 'user', content: `故事大纲：\n${outlineText(outline)}`},
    ])
    return parseScene(raw, true)
  },

  async advance(input: AdvanceInput) {
    const submissions = input.submissions.map((entry) => ({
      玩家: entry.name,
      角色: entry.role,
      选择: entry.choiceTitle,
      行动或台词: entry.text || '（无）',
    }))
    const history = input.history.map((record) => ({
      回合: record.round,
      提交: record.entries.map((entry) => `${entry.name}（角色${entry.role}）选择「${entry.choiceTitle}」，行动/台词：${entry.text || '（无）'}`),
      剧情: record.narration,
    }))
    const endingRule = input.mustEnd
      ? `这是第 ${input.round} 回合，已达到 ${input.maxRounds} 回合上限，isEnding 必须为 true，请收束故事并在 endingReason 中说明。`
      : `这是第 ${input.round} 回合，最多 ${input.maxRounds} 回合；只有剧情自然到达结尾方向时才把 isEnding 设为 true。`
    const raw = await chatJson([
      {
        role: 'system',
        content: `${DIRECTOR_RULES}
双方提交后，请综合两人是否做出相同选择来推进剧情：选择一致时体现配合，分歧时体现拉扯与各自的取舍。
${endingRule}
${SCENE_FORMAT}`,
      },
      {
        role: 'user',
        content: `故事大纲：\n${outlineText(input.outline)}

当前场景：${input.scene}
当前选择：${JSON.stringify(input.choices)}

本回合双方提交：
${JSON.stringify(submissions, null, 2)}

已完成回合：
${JSON.stringify(history, null, 2)}`,
      },
    ])
    return parseScene(raw, !input.mustEnd)
  },

  async summarize(input: SummaryInput) {
    const history = input.history.map((record) => ({
      回合: record.round,
      提交: record.entries.map((entry) => `${entry.name}（角色${entry.role}）选择「${entry.choiceTitle}」，行动/台词：${entry.text || '（无）'}`),
      剧情: record.narration,
    }))
    const raw = await chatJson([
      {
        role: 'system',
        content: `你根据真实回合记录为两名玩家生成共同总结，措辞中立，不做人格诊断、不评价两人是否合适、不编造记录之外的事实。
必须只输出一个 JSON 对象，字段固定为：
{"common":["..."],"differences":["..."],"complement":"...","topics":["..."]}
要求：
- common 恰好 3 条共同点，differences 恰好 2 条差异点，topics 恰好 3 个下次可聊的话题；
- common 和 differences 的每一条都必须引用真实回合证据，格式类似「第 1 回合，你们都选择了…」，引用必须来自给定记录；
- complement 是 1 句互补点；topics 基于两人真实表现，便于继续聊天。`,
      },
      {
        role: 'user',
        content: `故事大纲：\n${outlineText(input.outline)}

完整回合记录：
${JSON.stringify(history, null, 2)}`,
      },
    ])
    return parseReport(raw)
  },
}
