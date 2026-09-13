import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_ROUNDS,
  ROOM_CODE,
  create,
  join,
  retryAi,
  rooms,
  startGame,
  submitTurn,
  type GameAi,
  type SceneResult,
} from '../lib/room-store.ts'

const opening: SceneResult = {
  narration: '开场旁白',
  scene: '旧教学楼走廊',
  choices: [
    {id: 'follow', title: '跟上脚步'},
    {id: 'search', title: '先搜海报墙'},
  ],
  isEnding: false,
  endingReason: '',
}

function makeAi(overrides: Partial<GameAi> = {}): GameAi {
  return {
    async revealOpening() {
      return opening
    },
    async advance(input) {
      return {
        narration: `第 ${input.round} 回合剧情`,
        scene: `场景 ${input.round}`,
        choices: [
          {id: 'safe', title: `稳妥方案 ${input.round}`},
          {id: 'bold', title: `冒险方案 ${input.round}`},
        ],
        isEnding: input.mustEnd,
        endingReason: input.mustEnd ? '到达回合上限' : '',
      }
    },
    async summarize() {
      return {
        common: [
          '第 1 回合，你们都选择了跟进线索',
          '第 2 回合，你们都保留了退路',
          '第 3 回合，你们都愿意合作收尾',
        ],
        differences: ['第 1 回合，两人的行动风格不同', '第 2 回合，两人的关注点不同'],
        complement: '一人观察、一人行动，形成互补。',
        topics: ['面对风险时如何选择', '如何分工合作', '下次想探索什么'],
      }
    },
    ...overrides,
  }
}

function newRoom() {
  rooms.clear()
  const first = create()
  const second = join(first.room)
  return {room: first.room, firstId: first.playerId, secondId: second.playerId}
}

test('完整流程：创建、加入、双方提交、推进到结束并生成总结', async () => {
  const ai = makeAi()
  const {room, firstId, secondId} = newRoom()
  assert.equal(room.code, ROOM_CODE)
  assert.equal(room.players[firstId].name, '用户A')
  assert.equal(room.players[secondId].name, '用户B')

  await startGame(room, ai)
  assert.equal(room.state, 'playing')
  assert.equal(room.round, 1)
  assert.equal(room.choices.length, 2)
  assert.equal(room.narration, '开场旁白')

  await submitTurn(room, firstId, {choiceId: 'follow', text: '我先听脚步声'}, ai)
  assert.equal(room.round, 1, '只有一人提交时不推进回合')
  assert.equal(room.history.length, 0)
  assert.equal(Object.keys(room.submissions).length, 1)

  await submitTurn(room, secondId, {choiceId: 'search', text: ''}, ai)
  assert.equal(room.round, 2)
  assert.equal(room.history.length, 1)
  assert.equal(room.history[0].entries[0].choiceTitle, '跟上脚步')
  assert.equal(room.history[0].entries[1].choiceTitle, '先搜海报墙')
  assert.equal(room.history[0].narration, '第 1 回合剧情')

  let played = 1
  while (room.state === 'playing') {
    assert.equal(room.choices.length, 2)
    await submitTurn(room, firstId, {choiceId: room.choices[0].id, text: `甲第${room.round}回合`}, ai)
    await submitTurn(room, secondId, {choiceId: room.choices[1].id, text: `乙第${room.round}回合`}, ai)
    played += 1
    assert.ok(played <= MAX_ROUNDS, '回合数不能超过上限')
  }

  assert.equal(room.state, 'finished')
  assert.equal(room.history.length, MAX_ROUNDS)
  assert.ok(room.report)
  assert.equal(room.report.common.length, 3)
  assert.equal(room.report.differences.length, 2)
  assert.equal(room.report.topics.length, 3)
  assert.match(room.report.common[0], /第 1 回合/)
  assert.equal(room.history.at(-1)?.entries[1].text, `乙第${MAX_ROUNDS}回合`)
})

test('重复提交保持原提交，非法选择与超长文字被拒绝', async () => {
  const ai = makeAi()
  const {room, firstId, secondId} = newRoom()
  await startGame(room, ai)

  await assert.rejects(() => submitTurn(room, firstId, {choiceId: '不存在', text: ''}, ai), /选择无效/)
  await assert.rejects(
    () => submitTurn(room, firstId, {choiceId: 'follow', text: '字'.repeat(121)}, ai),
    /120/,
  )
  await assert.rejects(() => submitTurn(room, 'unknown-player', {choiceId: 'follow', text: ''}, ai), /不属于/)

  await submitTurn(room, firstId, {choiceId: 'follow', text: '第一次'}, ai)
  await submitTurn(room, firstId, {choiceId: 'search', text: '第二次'}, ai)
  assert.equal(room.submissions[firstId].choiceId, 'follow')
  assert.equal(room.submissions[firstId].text, '第一次')
  assert.equal(room.round, 1)

  await submitTurn(room, secondId, {choiceId: 'search', text: ''}, ai)
  assert.equal(room.round, 2)
})

test('AI 推进失败保留双方提交，重试后继续', async () => {
  const failing = makeAi({
    async advance() {
      throw new Error('AI 请求超时，请重试')
    },
  })
  const {room, firstId, secondId} = newRoom()
  await startGame(room, makeAi())
  await submitTurn(room, firstId, {choiceId: 'follow', text: '甲留下来的话'}, failing)
  await submitTurn(room, secondId, {choiceId: 'search', text: '乙留下来的话'}, failing)

  assert.equal(room.state, 'playing')
  assert.equal(room.round, 1)
  assert.equal(room.aiStatus, 'error')
  assert.match(room.aiError, /超时/)
  assert.equal(room.history.length, 0)
  assert.equal(Object.keys(room.submissions).length, 2)

  await retryAi(room, makeAi())
  assert.equal(room.aiStatus, 'idle')
  assert.equal(room.round, 2)
  assert.equal(room.history[0].entries[0].text, '甲留下来的话')
  assert.equal(room.history[0].entries[1].text, '乙留下来的话')
})

test('总结失败不阻塞结束状态，重试后补齐报告', async () => {
  const noReport = makeAi({
    async summarize() {
      throw new Error('AI 请求失败（HTTP 500），请重试')
    },
  })
  const {room, firstId, secondId} = newRoom()
  await startGame(room, noReport)

  while (room.state === 'playing') {
    await submitTurn(room, firstId, {choiceId: room.choices[0].id, text: '继续'}, noReport)
    await submitTurn(room, secondId, {choiceId: room.choices[1].id, text: '继续'}, noReport)
  }

  assert.equal(room.state, 'finished')
  const reportBeforeRetry = room.report
  assert.equal(reportBeforeRetry, undefined)
  assert.equal(room.aiStatus, 'error')
  assert.equal(room.history.length, MAX_ROUNDS)

  await retryAi(room, makeAi())
  assert.ok(room.report)
  assert.equal(room.aiStatus, 'idle')
  assert.equal(room.report.topics.length, 3)
})
