import type {StoryOutline} from './story.ts'

/** 列表接口返回的元数据 */
export type SeedSummary = {
  workId: string
  title: string
  labels: string[]
  description: string
  artwork: string
  tabArtwork: string
}

/** 详情接口返回的字段，正文与作者署名按需拉取 */
export type SeedDetail = {
  workId: string
  title: string
  labels: string[]
  introduction: string
  authorName: string
  authorAvatar: string
  content: string
}

/** 落库后的完整种子，outline 缺省表示尚未提炼 */
export type SeedRecord = SeedSummary & {
  introduction: string
  authorName: string
  authorAvatar: string
  content: string
  outline?: StoryOutline
}
