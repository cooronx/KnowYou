import type {SeedRepository} from './seed-repository.ts'
import type {StoryOutline, StoryOutlineAi} from './story.ts'
import {fetchStoryDetail} from './zhihu-content.ts'

/**
 * 把某篇知乎故事解析成可开局的双人剧本大纲。
 *
 * 独立成不依赖 Nest 的普通类，便于直接单测缓存、去重与降级逻辑。
 * 依赖注入的 Prisma 与 AI 实现由上层模块提供。
 */
export class StoryOutlineResolver {
  private readonly repo: SeedRepository
  private readonly ai: StoryOutlineAi
  // 同一 work_id 的详情+提炼只跑一次，避免并发开局重复调用接口和 LLM
  private readonly inflight = new Map<string, Promise<StoryOutline | undefined>>()

  constructor(repo: SeedRepository, ai: StoryOutlineAi) {
    this.repo = repo
    this.ai = ai
  }

  /** 未指定 work_id，或详情/提炼任一步失败时返回 undefined，不提供兜底剧本 */
  get(workId?: string): Promise<StoryOutline | undefined> {
    const id = workId?.trim()
    if (!id) return Promise.resolve(undefined)
    const running = this.inflight.get(id)
    if (running) return running
    const task = this.load(id).finally(() => this.inflight.delete(id))
    this.inflight.set(id, task)
    return task
  }

  private async load(workId: string): Promise<StoryOutline | undefined> {
    try {
      let record = await this.repo.find(workId)
      if (!record?.content) {
        const detail = await fetchStoryDetail(workId)
        if (detail) {
          await this.repo.saveDetail(detail)
          record = await this.repo.find(workId)
        }
      }
      if (!record) return undefined
      if (record.outline) return record.outline

      const outline = await this.ai.extractOutline({
        workId: record.workId,
        title: record.title,
        labels: record.labels,
        introduction: record.introduction,
        content: record.content,
      })
      await this.repo.saveOutline(workId, outline)
      return outline
    } catch (error) {
      console.error(`[seeds] 提炼大纲失败，跳过该剧本（${workId}）：`, error instanceof Error ? error.message : error)
      return undefined
    }
  }
}
