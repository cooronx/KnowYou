import type {SeedRepository} from './seed-repository.ts'
import type {SeedRecord, SeedSummary} from './seed-types.ts'
import type {StoryOutline} from './story.ts'

function summaryRecord(item: SeedSummary): SeedRecord {
  return {
    ...item,
    introduction: '',
    authorName: '',
    authorAvatar: '',
    content: '',
  }
}

/** 测试与本地调试用的内存实现，语义与 Prisma 实现保持一致 */
export function createMemorySeedRepository(initial: SeedRecord[] = []): SeedRepository {
  const seeds = new Map<string, SeedRecord>(initial.map((seed) => [seed.workId, structuredClone(seed)]))
  const clone = (seed: SeedRecord | undefined) => (seed ? structuredClone(seed) : undefined)

  return {
    async list() {
      return [...seeds.values()].map((seed) => structuredClone(seed))
    },

    async find(workId) {
      return clone(seeds.get(workId))
    },

    async saveSummaries(items) {
      for (const item of items) {
        const existing = seeds.get(item.workId)
        seeds.set(item.workId, existing ? {...existing, ...item} : summaryRecord(item))
      }
    },

    async saveDetail(detail) {
      const existing = seeds.get(detail.workId) ?? {...detail, description: '', artwork: ''}
      seeds.set(detail.workId, {...existing, ...detail})
    },

    async saveOutline(workId, outline: StoryOutline) {
      const existing = seeds.get(workId) ?? summaryRecord({workId, title: '', labels: [], description: '', artwork: ''})
      seeds.set(workId, {...existing, outline})
    },
  }
}
