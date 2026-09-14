import assert from 'node:assert/strict'
import test from 'node:test'
import {openAiGameAi, openAiStoryOutline} from '../src/ai.ts'
import {defaultStory} from '../src/story.ts'

function stubFetch(content: string, status = 200): () => void {
  const original = globalThis.fetch
  process.env.OPENAI_API_KEY = 'test-key'
  globalThis.fetch = async () =>
    new Response(JSON.stringify({choices: [{message: {role: 'assistant', content}}]}), {status})
  return () => {
    globalThis.fetch = original
  }
}

test('解析兼容服务用 Markdown 代码块包裹的 JSON', async () => {
  const restore = stubFetch(
    '```json\n{"narration":"开场","scene":"走廊","choices":[{"id":"a","title":"跟进"},{"id":"b","title":"等待"}],"isEnding":false,"endingReason":""}\n```',
  )
  try {
    const result = await openAiGameAi.revealOpening(defaultStory)
    assert.deepEqual(result.choices.map((choice) => choice.id), ['a', 'b'])
    assert.equal(result.narration, '开场')
    assert.equal(result.isEnding, false)
  } finally {
    restore()
  }
})

test('场景缺少选择时返回可重试错误', async () => {
  const restore = stubFetch('{"narration":"只有旁白","scene":"走廊","isEnding":false}')
  try {
    await assert.rejects(() => openAiGameAi.revealOpening(defaultStory), /2 个选择/)
  } finally {
    restore()
  }
})

test('总结条数不足时返回可重试错误', async () => {
  const restore = stubFetch(
    JSON.stringify({common: ['只有一条'], differences: ['a', 'b'], complement: '互补', topics: ['a', 'b', 'c']}),
  )
  try {
    await assert.rejects(() => openAiGameAi.summarize({outline: defaultStory, history: []}), /common/)
  } finally {
    restore()
  }
})

test('提炼大纲：角色 id 强制为 a/b，标签缺失回退原作标签', async () => {
  const restore = stubFetch(
    JSON.stringify({
      title: '被改标题',
      summary: '摘要',
      tags: [],
      opening: '开场',
      premise: '冲突',
      setting: '场景',
      characters: [
        {name: '甲', goal: '目标甲', traits: '谨慎'},
        {name: '乙', goal: '目标乙', traits: '果断'},
      ],
      endingHint: '收束',
    }),
  )
  try {
    const outline = await openAiStoryOutline.extractOutline({
      workId: '1747681485547843585',
      title: '原作标题',
      labels: ['惊悚', '脑洞'],
      introduction: '导语',
      content: '正文',
    })
    assert.equal(outline.id, '1747681485547843585', '大纲 id 绑定 work_id')
    assert.deepEqual(outline.characters.map((character) => character.id), ['a', 'b'])
    assert.deepEqual(outline.tags, ['惊悚', '脑洞'], '模型未给标签时回退原作标签')
  } finally {
    restore()
  }
})

test('提炼大纲：角色数量不为 2 时返回可重试错误', async () => {
  const restore = stubFetch(
    JSON.stringify({
      title: 't',
      summary: 's',
      tags: ['x'],
      opening: 'o',
      premise: 'p',
      setting: 'set',
      characters: [{name: '甲', goal: 'g', traits: 't'}],
      endingHint: 'e',
    }),
  )
  try {
    await assert.rejects(
      () =>
        openAiStoryOutline.extractOutline({
          workId: '1',
          title: 't',
          labels: [],
          introduction: '',
          content: '正文',
        }),
      /2 个角色/,
    )
  } finally {
    restore()
  }
})
