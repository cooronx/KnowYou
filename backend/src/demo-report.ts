import type {Report, Room} from './room-types.ts'

/**
 * Demo 模式不调用 AI 总结，而是从真实回合记录里随机拼出一份报告：
 * 结论尽量引用具体回合与选择，保证展示效果和"相对应"的观感，其余用通用模板补齐。
 */

const COMMON_FALLBACK = [
  '面对未知时，你们都会先确认彼此的位置，再决定下一步。',
  '你们都愿意把分歧留在故事里解决，而不是回避它。',
  '在需要承担风险的时刻，你们都没有把选择推给对方。',
  '你们都会先行动，再在过程里修正判断。',
]

const DIFFERENCE_FALLBACK = [
  '你更快做决定，对手更习惯先确认信息。',
  '你倾向直接行动，对手更倾向为彼此留好退路。',
  '面对压力时，你会往前一步，对手会先稳住局面。',
  '你关注当下能不能过关，对手关注之后会不会留下隐患。',
]

const COMPLEMENTS = [
  '一个负责向前，一个负责别丢下彼此。',
  '你的果断补上了对手的谨慎，对手的周全也兜住了你的冲动。',
  '你们把一次分歧变成了更完整的行动方案。',
  '同样的处境里，你们刚好缺一不可。',
]

const TOPICS = [
  '如果没有时间限制，你会怎么选？',
  '当对方的选择和你相反时，你最在意的是什么？',
  '下一次，你希望由谁来主导决定？',
  '压力最大的那一刻，你真正担心的是什么？',
  '你会在什么时候选择相信对方？',
  '如果重来一次，你想改变哪个选择？',
]

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

/** 从候选池里取到 count 条，优先保留真实证据，再用不重复的模板补齐 */
function fill(evidence: string[], fallback: string[], count: number): string[] {
  const result = evidence.slice(0, count)
  const pool = [...fallback].sort(() => Math.random() - 0.5)
  for (const item of pool) {
    if (result.length >= count) break
    if (!result.includes(item)) result.push(item)
  }
  return result.slice(0, count)
}

export function buildDemoReport(room: Room): Report {
  const common: string[] = []
  const differences: string[] = []

  for (const record of room.history) {
    const [mine, opponent] = record.entries
    if (!mine || !opponent) continue
    if (mine.choiceId === opponent.choiceId) {
      common.push(`第 ${record.round} 回合，你们都选择了「${mine.choiceTitle}」，在这个处境里做出了相似的判断。`)
    } else {
      differences.push(
        `第 ${record.round} 回合，你选择了「${mine.choiceTitle}」，对手选择了「${opponent.choiceTitle}」。`,
      )
    }
  }

  const topics = [...TOPICS].sort(() => Math.random() - 0.5).slice(0, 3)
  return {
    common: fill(common, COMMON_FALLBACK, 3),
    differences: fill(differences, DIFFERENCE_FALLBACK, 2),
    complement: pick(COMPLEMENTS),
    topics,
  }
}
