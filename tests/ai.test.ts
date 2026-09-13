import assert from 'node:assert/strict'
import test from 'node:test'
import {openAiGameAi} from '../lib/ai.ts'
import {story} from '../lib/story.ts'

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
    const result = await openAiGameAi.revealOpening(story)
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
    await assert.rejects(() => openAiGameAi.revealOpening(story), /2 个选择/)
  } finally {
    restore()
  }
})

test('总结条数不足时返回可重试错误', async () => {
  const restore = stubFetch(
    JSON.stringify({common: ['只有一条'], differences: ['a', 'b'], complement: '互补', topics: ['a', 'b', 'c']}),
  )
  try {
    await assert.rejects(() => openAiGameAi.summarize({outline: story, history: []}), /common/)
  } finally {
    restore()
  }
})
