import {Prisma, type PrismaClient} from '@prisma/client'
import type {SeedRepository} from './seed-repository.ts'
import type {SeedRecord} from './seed-types.ts'
import type {StoryOutline} from './story.ts'

type SeedRow = {
  workId: string
  title: string
  labels: string[]
  description: string
  artwork: string
  authorName: string
  authorAvatar: string
  introduction: string
  content: string
  outline: Prisma.JsonValue | null
}

function toRecord(row: SeedRow): SeedRecord {
  return {
    workId: row.workId,
    title: row.title,
    labels: row.labels,
    description: row.description,
    artwork: row.artwork,
    authorName: row.authorName,
    authorAvatar: row.authorAvatar,
    introduction: row.introduction,
    content: row.content,
    outline: (row.outline as StoryOutline | null) ?? undefined,
  }
}

/** getClient 是惰性的：客户端在首次真正访问数据库时才创建 */
export function createPrismaSeedRepository(getClient: () => PrismaClient): SeedRepository {
  return {
    async list() {
      const rows = await getClient().seed.findMany({orderBy: {fetchedAt: 'asc'}})
      return rows.map(toRecord)
    },

    async find(workId) {
      const row = await getClient().seed.findUnique({where: {workId}})
      return row ? toRecord(row) : undefined
    },

    async saveSummaries(items) {
      const prisma = getClient()
      await Promise.all(
        items.map((item) =>
          prisma.seed.upsert({
            where: {workId: item.workId},
            // 已存在的行只刷新元数据，保留已缓存的正文与大纲
            update: {
              title: item.title,
              labels: item.labels,
              description: item.description,
              artwork: item.artwork,
            },
            create: {
              workId: item.workId,
              title: item.title,
              labels: item.labels,
              description: item.description,
              artwork: item.artwork,
            },
          }),
        ),
      )
    },

    async saveDetail(detail) {
      await getClient().seed.upsert({
        where: {workId: detail.workId},
        update: {
          title: detail.title,
          labels: detail.labels,
          introduction: detail.introduction,
          authorName: detail.authorName,
          authorAvatar: detail.authorAvatar,
          content: detail.content,
        },
        create: detail,
      })
    },

    async saveOutline(workId, outline) {
      const outlineJson = outline as unknown as Prisma.InputJsonValue
      await getClient().seed.upsert({
        where: {workId},
        update: {outline: outlineJson},
        create: {workId, labels: [], outline: outlineJson},
      })
    },
  }
}
