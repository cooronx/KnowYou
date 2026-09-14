import {Inject, Injectable, type OnModuleDestroy, type OnModuleInit} from '@nestjs/common'
import {isAiConfigured} from '../../ai.ts'
import type {SeedRepository} from '../../seed-repository.ts'
import {StoryOutlineResolver} from '../../seed-outline.ts'
import type {SeedRecord, SeedSummary} from '../../seed-types.ts'
import type {StoryOutline, StoryOutlineAi} from '../../story.ts'
import {fetchStoryList} from '../../zhihu-content.ts'
import {STORY_OUTLINE_AI} from '../ai/ai.tokens.ts'
import {SEED_REPOSITORY} from './seeds.tokens.ts'

const DEFAULT_REFRESH_INTERVAL_MS = 15 * 60 * 1000

function refreshIntervalMs(): number {
  const value = Number(process.env.SEED_REFRESH_INTERVAL_MS)
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_REFRESH_INTERVAL_MS
}

@Injectable()
export class SeedsService implements OnModuleInit, OnModuleDestroy {
  private readonly resolver: StoryOutlineResolver
  private timer?: NodeJS.Timeout
  private refreshing = false

  constructor(
    @Inject(SEED_REPOSITORY) private readonly repo: SeedRepository,
    @Inject(STORY_OUTLINE_AI) outlineAi: StoryOutlineAi,
  ) {
    this.resolver = new StoryOutlineResolver(repo, outlineAi)
  }

  onModuleInit(): void {
    // 启动即刷新一次，之后按 interval 定时刷新；失败只记录日志，不阻塞服务
    void this.refresh()
    this.timer = setInterval(() => void this.refresh(), refreshIntervalMs())
    // 后台任务不应阻止进程退出
    this.timer.unref()
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
  }

  /** 拉取列表并补齐缺口：已有大纲的故事走缓存，没有的交给 AI 生成一次 */
  async refresh(): Promise<void> {
    if (this.refreshing) return
    this.refreshing = true
    try {
      await this.syncList()
      await this.ensureOutlines()
    } catch (error) {
      console.error('[seeds] 定时刷新失败，将继续使用已有缓存：', error instanceof Error ? error.message : error)
    } finally {
      this.refreshing = false
    }
  }

  /** 只对还没有 outline 的故事调用提炼，生成结果落库后下次直接命中缓存 */
  private async ensureOutlines(): Promise<void> {
    if (!isAiConfigured()) {
      console.warn('[seeds] 未配置 AI，跳过自动生成结构化大纲')
      return
    }
    const seeds = await this.repo.list()
    const pending = seeds.filter((seed) => !seed.outline)
    if (pending.length === 0) return
    console.info(`[seeds] 检测到 ${pending.length} 篇故事缺少结构化大纲，开始生成`)

    for (const seed of pending) {
      const outline = await this.resolver.get(seed.workId)
      if (!outline) {
        // 生成失败不落库、不兜底，等待下次刷新重试，期间该剧本不对外展示
        console.warn(`[seeds] 大纲生成失败，跳过并等待下次重试：${seed.title}`)
        continue
      }
      console.info(`[seeds] 已生成大纲：${seed.title}`)
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

  /** 只返回已生成结构化大纲的剧本，未就绪的不展示；正文与作者署名按详情单独读取 */
  async listSummaries(): Promise<SeedSummary[]> {
    const seeds = await this.repo.list()
    return seeds
      .filter((seed) => Boolean(seed.outline))
      .map(({workId, title, labels, description, artwork}) => ({
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

  /** 取得某篇故事的双人剧本大纲：优先用缓存，缺失时按需拉详情并提炼一次；失败返回 undefined */
  getOutline(workId?: string): Promise<StoryOutline | undefined> {
    return this.resolver.get(workId)
  }
}
