/**
 * Prisma 仓储的集成测试，需要可用的 Postgres（docker compose up -d）。
 * 未设置 DATABASE_URL 时整体跳过，保证纯单测环境仍可运行 npm test。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {PrismaPg} from '@prisma/adapter-pg'
import {PrismaClient} from '@prisma/client'
import {createPrismaRoomRepository} from '../src/room-repository-prisma.ts'
import type {GameAi, SceneResult} from '../src/room-types.ts'
import {
  MAX_ROUNDS,
  ROOM_CODE,
  create,
  getRoom,
  join,
  leave,
  retryAi,
  startGame,
  submitTurn,
} from '../src/room-store.ts'

const connectionString = process.env.DATABASE_URL?.trim()

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

test('Prisma 仓储集成测试', {skip: connectionString ? false : '未设置 DATABASE_URL'}, async (t) => {
  const prisma = new PrismaClient({adapter: new PrismaPg({connectionString: connectionString!})})
  const repo = createPrismaRoomRepository(() => prisma)
  t.after(async () => {
    await prisma.room.deleteMany({where: {code: ROOM_CODE}})
    await prisma.$disconnect()
  })

  const reset = async () => {
    await prisma.room.deleteMany({where: {code: ROOM_CODE}})
  }

  await t.test('完整流程落库：玩家、回合、总结都能读回', async () => {
    await reset()
    const ai = makeAi()
    const first = await create(repo)
    const second = await join(ROOM_CODE, repo)
    assert.equal(second.room.playerIds.length, 2)
    assert.equal(second.room.players[first.playerId].name, '用户A')
    assert.equal(second.room.players[second.playerId].role, 'b')

    let room = await startGame(ROOM_CODE, ai, repo)
    assert.equal(room.state, 'playing')
    // Json 列往返：choices 必须原样读回
    assert.deepEqual(room.choices, opening.choices)

    room = await submitTurn(ROOM_CODE, first.playerId, {choiceId: 'follow', text: '甲的话'}, ai, repo)
    assert.equal(room.round, 1)
    assert.deepEqual(room.submissions[first.playerId], {choiceId: 'follow', text: '甲的话'})

    room = await submitTurn(ROOM_CODE, second.playerId, {choiceId: 'search', text: ''}, ai, repo)
    assert.equal(room.round, 2)
    assert.equal(room.history.length, 1)
    assert.equal(room.history[0].entries[0].text, '甲的话')
    assert.deepEqual(room.submissions, {}, '推进后清空提交')

    while (room.state === 'playing') {
      const [a, b] = room.choices
      await submitTurn(ROOM_CODE, first.playerId, {choiceId: a.id, text: '继续'}, ai, repo)
      room = await submitTurn(ROOM_CODE, second.playerId, {choiceId: b.id, text: '继续'}, ai, repo)
    }

    // 重新从数据库读，确认落库而非内存残留
    const stored = await getRoom(ROOM_CODE, repo)
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

  await t.test('mutate 抛错时事务回滚，不留下部分写入', async () => {
    await reset()
    const ai = makeAi()
    const first = await create(repo)
    await join(ROOM_CODE, repo)
    await startGame(ROOM_CODE, ai, repo)

    await assert.rejects(
      () => submitTurn(ROOM_CODE, first.playerId, {choiceId: '不存在', text: '不该落库'}, ai, repo),
      /选择无效/,
    )
    const room = await getRoom(ROOM_CODE, repo)
    assert.deepEqual(room?.submissions, {}, '被拒绝的提交不能落库')
  })

  await t.test('并发提交只推进一个回合', async () => {
    await reset()
    const ai = makeAi()
    const first = await create(repo)
    const second = await join(ROOM_CODE, repo)
    await startGame(ROOM_CODE, ai, repo)

    // 两名玩家同时提交：行锁必须让"双方都已提交"只被判定一次
    await Promise.all([
      submitTurn(ROOM_CODE, first.playerId, {choiceId: 'follow', text: '甲'}, ai, repo),
      submitTurn(ROOM_CODE, second.playerId, {choiceId: 'search', text: '乙'}, ai, repo),
    ])

    const room = await getRoom(ROOM_CODE, repo)
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
    const first = await create(repo)
    const second = await join(ROOM_CODE, repo)
    await startGame(ROOM_CODE, makeAi(), repo)
    await submitTurn(ROOM_CODE, first.playerId, {choiceId: 'follow', text: '甲'}, failing, repo)
    const failed = await submitTurn(ROOM_CODE, second.playerId, {choiceId: 'search', text: '乙'}, failing, repo)
    assert.equal(failed.aiStatus, 'error')
    assert.equal(failed.history.length, 0)
    assert.equal(Object.keys(failed.submissions).length, 2, '失败后保留双方提交')

    const retried = await retryAi(ROOM_CODE, makeAi(), repo)
    assert.equal(retried.aiStatus, 'idle')
    assert.equal(retried.round, 2)
    assert.equal(retried.history[0].entries[0].text, '甲')

    // 打到结束后重开，旧回合与总结必须被清掉
    let room = retried
    const ai = makeAi()
    while (room.state === 'playing') {
      const [a, b] = room.choices
      await submitTurn(ROOM_CODE, first.playerId, {choiceId: a.id, text: '继续'}, ai, repo)
      room = await submitTurn(ROOM_CODE, second.playerId, {choiceId: b.id, text: '继续'}, ai, repo)
    }
    assert.equal(room.state, 'finished')

    const restarted = await create(repo)
    assert.equal(restarted.room.state, 'waiting')
    assert.equal(restarted.room.history.length, 0)
    assert.equal(restarted.room.report, undefined)
    assert.equal(restarted.room.playerIds.length, 1)
    const storedTurns = await prisma.turn.count({where: {roomCode: ROOM_CODE}})
    assert.equal(storedTurns, 0, '重开后旧回合已被级联删除')
  })

  await t.test('座位回收与压缩不违反 (roomCode, seat) 唯一约束', async () => {
    await reset()
    const first = await create(repo)
    const second = await join(ROOM_CODE, repo)
    const seatsBefore = await prisma.player.findMany({
      where: {roomCode: ROOM_CODE},
      orderBy: {seat: 'asc'},
      select: {id: true, seat: true},
    })
    assert.deepEqual(
      seatsBefore.map((player) => player.seat),
      [0, 1],
    )

    // 让 0 号座位离线：下一次 join 会在同一个事务里删除它、把 1 号压到 0、再建新玩家。
    // 三步顺序若写错就会撞上 @@unique([roomCode, seat])，这条只有真库能验出来
    await repo.withLock(ROOM_CODE, (room) => {
      room.players[first.playerId].lastSeenAt = Date.now() - 6 * 60_000
    })

    const third = await join(ROOM_CODE, repo)
    assert.equal(third.room.playerIds.length, 2)
    assert.equal(third.room.players[first.playerId], undefined, '离线玩家已被删除')

    const seatsAfter = await prisma.player.findMany({
      where: {roomCode: ROOM_CODE},
      orderBy: {seat: 'asc'},
      select: {id: true, seat: true},
    })
    assert.deepEqual(
      seatsAfter.map((player) => player.seat),
      [0, 1],
      '压缩后座位仍是连续的 0/1',
    )
    // 留下的玩家被压到 0 号，新玩家接在 1 号
    assert.equal(seatsAfter[0].id, second.playerId)
    assert.equal(seatsAfter[1].id, third.playerId)
    // seat 顺序决定回合结算顺序，必须与 playerIds 一致
    assert.deepEqual(third.room.playerIds, [second.playerId, third.playerId])

    // 主动退出同样要把座位落库删除
    const afterLeave = await leave(ROOM_CODE, second.playerId, repo)
    assert.equal(afterLeave.playerIds.length, 1)
    const remaining = await prisma.player.findMany({where: {roomCode: ROOM_CODE}, select: {id: true, seat: true}})
    assert.deepEqual(remaining, [{id: third.playerId, seat: 0}])
  })

  await t.test('playing 中一方离线：本局标记为中途结束且不生成报告', async () => {
    await reset()
    const ai = makeAi()
    const first = await create(repo)
    const second = await join(ROOM_CODE, repo)
    await startGame(ROOM_CODE, ai, repo)

    await repo.withLock(ROOM_CODE, (room) => {
      room.players[second.playerId].lastSeenAt = Date.now() - 6 * 60_000
    })

    const room = await getRoom(ROOM_CODE, repo, first.playerId)
    assert.ok(room)
    assert.equal(room.state, 'finished')
    assert.equal(room.abandoned, true)
    assert.equal(room.report, undefined)

    // abandoned 必须落库，重新读也应保持
    const stored = await getRoom(ROOM_CODE, repo)
    assert.equal(stored?.abandoned, true)
    const reports = await prisma.report.count({where: {roomCode: ROOM_CODE}})
    assert.equal(reports, 0, '中途结束的局不写报告')

    // 房间可以重开一局，abandoned 被重置
    const restarted = await create(repo)
    assert.equal(restarted.room.state, 'waiting')
    assert.equal(restarted.room.abandoned, false)
    assert.equal(restarted.room.playerIds.length, 1)
  })
})
