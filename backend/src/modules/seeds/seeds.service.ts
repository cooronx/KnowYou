import {Inject, Injectable, type OnModuleInit} from '@nestjs/common'
import type {SeedRepository} from '../../seed-repository.ts'
import {StoryOutlineResolver} from '../../seed-outline.ts'
import type {SeedRecord, SeedSummary} from '../../seed-types.ts'
import type {StoryOutline, StoryOutlineAi} from '../../story.ts'
import {fetchStoryList} from '../../zhihu-content.ts'
import {STORY_OUTLINE_AI} from '../ai/ai.tokens.ts'
import {SEED_REPOSITORY} from './seeds.tokens.ts'

@Injectable()
export class SeedsService implements OnModuleInit {
  private readonly resolver: StoryOutlineResolver

  constructor(
    @Inject(SEED_REPOSITORY) private readonly repo: SeedRepository,
    @Inject(STORY_OUTLINE_AI) outlineAi: StoryOutlineAi,
  ) {
    this.resolver = new StoryOutlineResolver(repo, outlineAi)
  }

  onModuleInit(): void {
    // 预热失败不能阻塞服务启动，冷启动改用已落库的缓存或默认剧本
    void this.warmup()
  }

  private async warmup(): Promise<void> {
    try {
      const seeds = await this.repo.list()
      if (seeds.length === 0) await this.syncList()
    } catch (error) {
      console.error('[seeds] 启动同步失败，将使用已有缓存：', error instanceof Error ? error.message : error)
    }
  }

  /** 拉取故事列表并幂等落库，返回本次同步到的元数据 */
  async syncList(): Promise<SeedSummary[]> {
    const summaries = await fetchStoryList()
    await this.repo.saveSummaries(summaries)
    console.info(`[seeds] 已同步 ${summaries.length} 条剧本种子`)
    return summaries
  }

  list(): Promise<SeedRecord[]> {
    return this.repo.list()
  }

  /** 列表只返回元数据，正文与作者署名按详情单独读取 */
  async listSummaries(): Promise<SeedSummary[]> {
    const seeds = await this.repo.list()
    return seeds.map(({workId, title, labels, description, artwork}) => ({
      workId,
      title,
      labels,
      description,
      artwork,
    }))
  }

  get(workId: string): Promise<SeedRecord | undefined> {
    return this.repo.find(workId)
  }

  /** 取得某篇故事的双人剧本大纲：优先用缓存，缺失时按需拉详情并提炼一次 */
  getOutline(workId?: string): Promise<StoryOutline> {
    return this.resolver.get(workId)
  }
}
