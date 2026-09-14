import assert from 'node:assert/strict'
import test from 'node:test'
import {createMemorySeedRepository} from '../src/seed-repository-memory.ts'
import type {SeedRecord} from '../src/seed-types.ts'
import {StoryOutlineResolver} from '../src/seed-outline.ts'
import type {StoryOutline, StoryOutlineAi} from '../src/story.ts'
import {fetchStoryDetail, fetchStoryList, parseStoryDetail, parseStoryList} from '../src/zhihu-content.ts'

const sampleOutline: StoryOutline = {
  id: '100',
  title: '被提炼的标题',
  summary: '摘要',
  tags: ['悬疑'],
  opening: '开场',
  premise: '冲突',
  setting: '场景',
  characters: [
    {id: 'a', name: '甲', goal: '目标甲', traits: '谨慎'},
    {id: 'b', name: '乙', goal: '目标乙', traits: '果断'},
  ],
  endingHint: '收束',
}

function seed(overrides: Partial<SeedRecord> & {workId: string}): SeedRecord {
  return {
    title: '标题',
    labels: ['悬疑'],
    description: '摘要',
    artwork: '',
    introduction: '导语',
    authorName: '作者',
    authorAvatar: '',
    content: '正文',
    ...overrides,
  }
}

function makeOutlineAi(onCall?: (workId: string) => void): StoryOutlineAi {
  return {
    async extractOutline(source) {
      onCall?.(source.workId)
      return {...sampleOutline, id: source.workId, tags: source.labels}
    },
  }
}

function mockFetch(handler: (url: string, init: RequestInit) => Response) {
  const original = globalThis.fetch
  const calls: {url: string; init: RequestInit}[] = []
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    calls.push({url, init})
    return handler(url, init)
  }) as typeof fetch
  return {calls, restore: () => {globalThis.fetch = original}}
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}})
}

test('解析故事列表：work_id 以字符串保留，缺失或非字符串项被跳过', () => {
  const list = parseStoryList([
    {work_id: '1747681485547843585', title: '近视眼勇闯恐怖游戏', labels: ['惊悚', '脑洞'], description: '摘要', artwork: 'https://x/a.jpg'},
    {title: '没有 work_id 的项被跳过'},
    {work_id: 123, title: '未加引号的数字型 work_id 不接收，避免 int64 精度风险'},
    null,
  ])
  assert.equal(list.length, 1)
  assert.equal(list[0].workId, '1747681485547843585', 'int64 全程字符串')
  assert.deepEqual(list[0].labels, ['惊悚', '脑洞'])
  assert.throws(() => parseStoryList({}), /格式错误/)
})

test('解析故事详情：字段缺失不补造', () => {
  const detail = parseStoryDetail(
    {work_id: '9', chapter_name: '章节名', labels: ['玄幻'], author_name: '沈南因', author_avatar: 'https://x/a.jpg', introduction: '导语', content: '正文'},
    '9',
  )
  assert.ok(detail)
  assert.equal(detail.title, '章节名')
  assert.equal(detail.authorName, '沈南因')
  assert.equal(detail.content, '正文')

  const sparse = parseStoryDetail({}, '10')
  assert.ok(sparse)
  assert.equal(sparse.title, '')
  assert.equal(sparse.content, '')
  assert.equal(parseStoryDetail(null, '10'), null)
})

test('内容客户端：请求固定路径并把 work_id 作为单一路径段编码', async () => {
  const listMock = mockFetch(() => jsonResponse([{work_id: '7', title: 't', labels: []}]))
  try {
    const list = await fetchStoryList()
    assert.equal(list[0].workId, '7')
    assert.equal(listMock.calls[0].url, 'https://api.zhihu.com/km-indep-home/hackathon/v2/story/list')
  } finally {
    listMock.restore()
  }

  const detailMock = mockFetch(() => jsonResponse({chapter_name: 't', content: 'c'}))
  try {
    await fetchStoryDetail('a/b')
    assert.equal(detailMock.calls[0].url, 'https://api.zhihu.com/km-indep-home/hackathon/v2/story/a%2Fb')
  } finally {
    detailMock.restore()
  }
})

test('已缓存大纲直接返回，不重复调用提炼', async () => {
  const repo = createMemorySeedRepository([seed({workId: '100', outline: sampleOutline})])
  const calls: string[] = []
  const service = new StoryOutlineResolver(repo, makeOutlineAi((id) => calls.push(id)))

  const outline = await service.get('100')
  assert.ok(outline)
  assert.equal(outline.title, sampleOutline.title)
  assert.deepEqual(calls, [])
})

test('缺少大纲时提炼一次并落库，之后走缓存', async () => {
  const repo = createMemorySeedRepository([seed({workId: '101'})])
  const calls: string[] = []
  const service = new StoryOutlineResolver(repo, makeOutlineAi((id) => calls.push(id)))

  const first = await service.get('101')
  assert.ok(first)
  assert.equal(first.id, '101')
  assert.deepEqual(calls, ['101'])
  assert.ok((await repo.find('101'))?.outline, '大纲应落库')

  await service.get('101')
  assert.deepEqual(calls, ['101'], '第二次直接读缓存')
})

test('并发取同一大纲只提炼一次', async () => {
  const repo = createMemorySeedRepository([seed({workId: '102'})])
  let calls = 0
  const service = new StoryOutlineResolver(repo, {
    async extractOutline() {
      calls += 1
      await new Promise((resolve) => setTimeout(resolve, 10))
      return sampleOutline
    },
  })

  await Promise.all([service.get('102'), service.get('102')])
  assert.equal(calls, 1)
})

test('提炼失败返回 undefined 且不落库，未指定 work_id 同样无兜底', async () => {
  const repo = createMemorySeedRepository([seed({workId: '103'})])
  const service = new StoryOutlineResolver(repo, {
    async extractOutline() {
      throw new Error('AI 请求失败')
    },
  })

  assert.equal(await service.get('103'), undefined)
  assert.equal((await repo.find('103'))?.outline, undefined, '失败不落库，等待下次重试')
  assert.equal(await service.get(undefined), undefined)
})
