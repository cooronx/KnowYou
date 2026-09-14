import type {SeedDetail, SeedRecord, SeedSummary} from './seed-types.ts'
import type {StoryOutline} from './story.ts'

/**
 * 剧本种子持久化边界。服务层只依赖这个接口，测试注入内存实现，生产注入 Prisma 实现。
 *
 * 列表同步只更新元数据，不覆盖已缓存的正文与大纲；详情与大纲各自单独写入，
 * 避免一次失败把已经拿到的数据清空。
 */
export interface SeedRepository {
  list(): Promise<SeedRecord[]>
  find(workId: string): Promise<SeedRecord | undefined>
  /** 幂等写入列表元数据，已存在的行只更新元数据字段 */
  saveSummaries(items: SeedSummary[]): Promise<void>
  saveDetail(detail: SeedDetail): Promise<void>
  saveOutline(workId: string, outline: StoryOutline): Promise<void>
}
