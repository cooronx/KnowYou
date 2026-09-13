/**
 * rdb 仓储的集成测试，走 CloudBase HTTP 通道打到云数据库。
 * 未配置 CLOUDBASE_ENV_ID / CLOUDBASE_API_KEY 时整体跳过，保证纯单测环境仍可运行 npm test。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {getRdb, unwrap} from '../lib/rdb.ts'
import {createRdbRoomRepository} from '../lib/room-repository-rdb.ts'
import type {GameAi, SceneResult} from '../lib/room-types.ts'
import {MAX_ROUNDS, getRoom, join, retryAi, startGame, submitTurn} from '../lib/room-store.ts'

const hasCloudbase = Boolean(
  process.env.CLOUDBASE_ENV_ID?.trim() && process.env.CLOUDBASE_API_KEY?.trim(),
)

// 不要用应用的 DEMO01 做测试，避免清掉真实房间数据
const TEST_CODE = 'ITEST01'

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
        common: ['第 1 回合，你们都跟进了线索', '第 2 回合，你们都留了退路', '第 3 回合，你们都愿意收尾'],
        differences: ['第 1 回合，行动风格不同', '第 2 回合，关注点不同'],
        complement: '一人观察、一人行动，形成互补。',
        topics: ['如何选择风险', '如何分工', '下次探索什么'],
      }
    },
    ...overrides,
  }
}

test('rdb 仓储集成测试（CloudBase）', {skip: hasCloudbase ? false : '未配置 CLOUDBASE_*'}, async (t) => {
  const repo = createRdbRoomRepository()

  const reset = async () => {
    await unwrap(getRdb().from('Room').delete().eq('code', TEST_CODE).select())
  }

  // create() 固定使用应用房间码，这里用测试房间码走 ensureRoom + join
  const createRoom = async () => {
    await repo.ensureRoom(TEST_CODE)
    return join(TEST_CODE, repo)
  }

  t.after(reset)

  await t.test('完整流程落库：玩家、回合、总结都能读回', async () => {
    await reset()
    const ai = makeAi()
    const first = await createRoom()
    const second = await join(TEST_CODE, repo)
    assert.equal(second.room.playerIds.length, 2)
    assert.equal(second.room.players[first.playerId].name, '用户A')
    assert.equal(second.room.players[second.playerId].role, 'b')

    let room = await startGame(TEST_CODE, ai, repo)
    assert.equal(room.state, 'playing')
    // JSONB 列往返：choices 必须原样读回
    assert.deepEqual(room.choices, opening.choices)

    room = await submitTurn(TEST_CODE, first.playerId, {choiceId: 'follow', text: '甲的话'}, ai, repo)
    assert.equal(room.round, 1)
    assert.deepEqual(room.submissions[first.playerId], {choiceId: 'follow', text: '甲的话'})

    room = await submitTurn(TEST_CODE, second.playerId, {choiceId: 'search', text: ''}, ai, repo)
    assert.equal(room.round, 2)
    assert.equal(room.history.length, 1)
    assert.equal(room.history[0].entries[0].text, '甲的话')
    assert.deepEqual(room.submissions, {}, '推进后清空提交')

    while (room.state === 'playing') {
      const [a, b] = room.choices
      await submitTurn(TEST_CODE, first.playerId, {choiceId: a.id, text: '继续'}, ai, repo)
      room = await submitTurn(TEST_CODE, second.playerId, {choiceId: b.id, text: '继续'}, ai, repo)
    }

    // 重新从数据库读，确认落库而非内存残留
    const stored = await getRoom(TEST_CODE, repo)
    assert.ok(stored)
    assert.equal(stored.state, 'finished')
    assert.equal(stored.history.length, MAX_ROUNDS)
    assert.equal(stored.playerIds.length, 2)
    assert.ok(stored.report)
    assert.equal(stored.report.common.length, 3)
    assert.equal(stored.report.topics.length, 3)
    // 回合顺序必须按 round 升序读回
    assert.deepEqual(
      stored.history.map((turn) => turn.round),
      Array.from({length: MAX_ROUNDS}, (_, index) => index + 1),
    )
  })

  await t.test('mutate 抛错时不留下部分写入', async () => {
    await reset()
    const ai = makeAi()
    const first = await createRoom()
    await join(TEST_CODE, repo)
    await startGame(TEST_CODE, ai, repo)

    await assert.rejects(
      () => submitTurn(TEST_CODE, first.playerId, {choiceId: '不存在', text: '不该落库'}, ai, repo),
      /选择无效/,
    )
    const room = await getRoom(TEST_CODE, repo)
    assert.deepEqual(room?.submissions, {}, '被拒绝的提交不能落库')
  })

  await t.test('并发提交只推进一个回合', async () => {
    await reset()
    const ai = makeAi()
    const first = await createRoom()
    const second = await join(TEST_CODE, repo)
    await startGame(TEST_CODE, ai, repo)

    // 两名玩家同时提交：乐观锁必须让"双方都已提交"只被判定一次
    await Promise.all([
      submitTurn(TEST_CODE, first.playerId, {choiceId: 'follow', text: '甲'}, ai, repo),
      submitTurn(TEST_CODE, second.playerId, {choiceId: 'search', text: '乙'}, ai, repo),
    ])

    const room = await getRoom(TEST_CODE, repo)
    assert.ok(room)
    assert.equal(room.round, 2, '并发提交后只推进一个回合')
    assert.equal(room.history.length, 1, '只能产生一条回合记录')
    assert.equal(room.history[0].entries.length, 2, '回合记录包含双方提交')
  })

  await t.test('AI 失败保留提交，重试后补齐；已结束房间可重开', async () => {
    await reset()
    const failing = makeAi({
      async advance() {
        throw new Error('AI 请求超时，请重试')
      },
    })
    const first = await createRoom()
    const second = await join(TEST_CODE, repo)
    await startGame(TEST_CODE, makeAi(), repo)
    await submitTurn(TEST_CODE, first.playerId, {choiceId: 'follow', text: '甲'}, failing, repo)
    const failed = await submitTurn(TEST_CODE, second.playerId, {choiceId: 'search', text: '乙'}, failing, repo)
    assert.equal(failed.aiStatus, 'error')
    assert.equal(failed.history.length, 0)
    assert.equal(Object.keys(failed.submissions).length, 2, '失败后保留双方提交')

    const retried = await retryAi(TEST_CODE, makeAi(), repo)
    assert.equal(retried.aiStatus, 'idle')
    assert.equal(retried.round, 2)
    assert.equal(retried.history[0].entries[0].text, '甲')

    // 打到结束后重开，旧回合与总结必须被清掉
    let room = retried
    const ai = makeAi()
    while (room.state === 'playing') {
      const [a, b] = room.choices
      await submitTurn(TEST_CODE, first.playerId, {choiceId: a.id, text: '继续'}, ai, repo)
      room = await submitTurn(TEST_CODE, second.playerId, {choiceId: b.id, text: '继续'}, ai, repo)
    }
    assert.equal(room.state, 'finished')

    const restarted = await createRoom()
    assert.equal(restarted.room.state, 'waiting')
    assert.equal(restarted.room.history.length, 0)
    assert.equal(restarted.room.report, undefined)
    assert.equal(restarted.room.playerIds.length, 1)
    const storedTurns = await unwrap(getRdb().from('Turn').select('*').eq('roomCode', TEST_CODE))
    assert.equal(storedTurns.length, 0, '重开后旧回合已被级联删除')
  })
})
