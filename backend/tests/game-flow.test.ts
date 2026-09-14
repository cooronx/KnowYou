import assert from 'node:assert/strict'
import test from 'node:test'
import type {RoomRepository} from '../src/room-repository.ts'
import {createMemoryRoomRepository} from '../src/room-repository-memory.ts'
import type {GameAi, SceneResult} from '../src/room-types.ts'
import {defaultStory, type StoryOutline} from '../src/story.ts'
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

async function newRoom() {
  const repo = createMemoryRoomRepository()
  const first = await create(repo)
  const second = await join(ROOM_CODE, repo)
  return {repo, room: second.room, firstId: first.playerId, secondId: second.playerId}
}

async function readRoom(repo: RoomRepository) {
  const room = await getRoom(ROOM_CODE, repo)
  assert.ok(room, '房间应当存在')
  return room
}

test('完整流程：创建、加入、双方提交、推进到结束并生成总结', async () => {
  const ai = makeAi()
  const {repo, room: joined, firstId, secondId} = await newRoom()
  assert.equal(joined.code, ROOM_CODE)
  assert.equal(joined.players[firstId].name, '用户A')
  assert.equal(joined.players[secondId].name, '用户B')

  let room = await startGame(ROOM_CODE, ai, repo)
  assert.equal(room.state, 'playing')
  assert.equal(room.round, 1)
  assert.equal(room.choices.length, 2)
  assert.equal(room.narration, '开场旁白')

  room = await submitTurn(ROOM_CODE, firstId, {choiceId: 'follow', text: '我先听脚步声'}, ai, repo)
  assert.equal(room.round, 1, '只有一人提交时不推进回合')
  assert.equal(room.history.length, 0)
  assert.equal(Object.keys(room.submissions).length, 1)

  room = await submitTurn(ROOM_CODE, secondId, {choiceId: 'search', text: ''}, ai, repo)
  assert.equal(room.round, 2)
  assert.equal(room.history.length, 1)
  assert.equal(room.history[0].entries[0].choiceTitle, '跟上脚步')
  assert.equal(room.history[0].entries[1].choiceTitle, '先搜海报墙')
  assert.equal(room.history[0].narration, '第 1 回合剧情')

  let played = 1
  while (room.state === 'playing') {
    assert.equal(room.choices.length, 2)
    const currentRound = room.round
    await submitTurn(ROOM_CODE, firstId, {choiceId: room.choices[0].id, text: `甲第${currentRound}回合`}, ai, repo)
    room = await submitTurn(
      ROOM_CODE,
      secondId,
      {choiceId: room.choices[1].id, text: `乙第${currentRound}回合`},
      ai,
      repo,
    )
    played += 1
    assert.ok(played <= MAX_ROUNDS, '回合数不能超过上限')
  }

  assert.equal(room.state, 'finished')
  assert.equal(room.history.length, MAX_ROUNDS)
  const finished = await readRoom(repo)
  assert.ok(finished.report)
  assert.equal(finished.report.common.length, 3)
  assert.equal(finished.report.differences.length, 2)
  assert.equal(finished.report.topics.length, 3)
  assert.match(finished.report.common[0], /第 1 回合/)
  assert.equal(finished.history.at(-1)?.entries[1].text, `乙第${MAX_ROUNDS}回合`)
})

test('重复提交保持原提交，非法选择与超长文字被拒绝', async () => {
  const ai = makeAi()
  const {repo, firstId, secondId} = await newRoom()
  await startGame(ROOM_CODE, ai, repo)

  await assert.rejects(
    () => submitTurn(ROOM_CODE, firstId, {choiceId: '不存在', text: ''}, ai, repo),
    /选择无效/,
  )
  await assert.rejects(
    () => submitTurn(ROOM_CODE, firstId, {choiceId: 'follow', text: '字'.repeat(121)}, ai, repo),
    /120/,
  )
  await assert.rejects(
    () => submitTurn(ROOM_CODE, 'unknown-player', {choiceId: 'follow', text: ''}, ai, repo),
    /不属于/,
  )
  // 被拒绝的提交不能留下痕迹
  assert.equal(Object.keys((await readRoom(repo)).submissions).length, 0)

  await submitTurn(ROOM_CODE, firstId, {choiceId: 'follow', text: '第一次'}, ai, repo)
  const afterRepeat = await submitTurn(ROOM_CODE, firstId, {choiceId: 'search', text: '第二次'}, ai, repo)
  assert.equal(afterRepeat.submissions[firstId].choiceId, 'follow')
  assert.equal(afterRepeat.submissions[firstId].text, '第一次')
  assert.equal(afterRepeat.round, 1)

  const advanced = await submitTurn(ROOM_CODE, secondId, {choiceId: 'search', text: ''}, ai, repo)
  assert.equal(advanced.round, 2)
})

test('AI 推进失败保留双方提交，重试后继续', async () => {
  const failing = makeAi({
    async advance() {
      throw new Error('AI 请求超时，请重试')
    },
  })
  const {repo, firstId, secondId} = await newRoom()
  await startGame(ROOM_CODE, makeAi(), repo)
  await submitTurn(ROOM_CODE, firstId, {choiceId: 'follow', text: '甲留下来的话'}, failing, repo)
  const failed = await submitTurn(ROOM_CODE, secondId, {choiceId: 'search', text: '乙留下来的话'}, failing, repo)

  assert.equal(failed.state, 'playing')
  assert.equal(failed.round, 1)
  assert.equal(failed.aiStatus, 'error')
  assert.match(failed.aiError, /超时/)
  assert.equal(failed.history.length, 0)
  assert.equal(Object.keys(failed.submissions).length, 2)

  const retried = await retryAi(ROOM_CODE, makeAi(), repo)
  assert.equal(retried.aiStatus, 'idle')
  assert.equal(retried.round, 2)
  assert.equal(retried.history[0].entries[0].text, '甲留下来的话')
  assert.equal(retried.history[0].entries[1].text, '乙留下来的话')
})

test('总结失败不阻塞结束状态，重试后补齐报告', async () => {
  const noReport = makeAi({
    async summarize() {
      throw new Error('AI 请求失败（HTTP 500），请重试')
    },
  })
  const {repo, firstId, secondId} = await newRoom()
  let room = await startGame(ROOM_CODE, noReport, repo)

  while (room.state === 'playing') {
    await submitTurn(ROOM_CODE, firstId, {choiceId: room.choices[0].id, text: '继续'}, noReport, repo)
    room = await submitTurn(ROOM_CODE, secondId, {choiceId: room.choices[1].id, text: '继续'}, noReport, repo)
  }

  assert.equal(room.state, 'finished')
  assert.equal(room.report, undefined)
  assert.equal(room.aiStatus, 'error')
  assert.equal(room.history.length, MAX_ROUNDS)

  const retried = await retryAi(ROOM_CODE, makeAi(), repo)
  assert.ok(retried.report)
  assert.equal(retried.aiStatus, 'idle')
  assert.equal(retried.report.topics.length, 3)
})

test('开局绑定指定剧本大纲，各阶段 AI 都收到该大纲', async () => {
  const outline: StoryOutline = {...defaultStory, id: 'custom-seed', title: '自定义本'}
  const received: string[] = []
  const base = makeAi()
  const ai: GameAi = {
    async revealOpening(value) {
      received.push(`opening:${value.id}`)
      return base.revealOpening(value)
    },
    async advance(input) {
      received.push(`advance:${input.outline.id}`)
      return base.advance(input)
    },
    async summarize(input) {
      received.push(`summary:${input.outline.id}`)
      return base.summarize(input)
    },
  }

  const {repo, firstId, secondId} = await newRoom()
  let room = await startGame(ROOM_CODE, ai, repo, outline)
  assert.equal(room.outline.id, 'custom-seed', '房间绑定开局传入的大纲')

  while (room.state === 'playing') {
    await submitTurn(ROOM_CODE, firstId, {choiceId: room.choices[0].id, text: '继续'}, ai, repo)
    room = await submitTurn(ROOM_CODE, secondId, {choiceId: room.choices[1].id, text: '继续'}, ai, repo)
  }

  assert.match(received[0], /^opening:custom-seed$/)
  assert.ok(received.some((item) => item === 'advance:custom-seed'), '推进阶段收到绑定大纲')
  assert.ok(received.at(-1) === 'summary:custom-seed', '总结阶段收到绑定大纲')
})

test('已结束的房间可以重开一局，旧回合与总结被清空', async () => {
  const ai = makeAi()
  const {repo, firstId, secondId} = await newRoom()
  let room = await startGame(ROOM_CODE, ai, repo)
  while (room.state === 'playing') {
    await submitTurn(ROOM_CODE, firstId, {choiceId: room.choices[0].id, text: '继续'}, ai, repo)
    room = await submitTurn(ROOM_CODE, secondId, {choiceId: room.choices[1].id, text: '继续'}, ai, repo)
  }
  assert.equal(room.state, 'finished')

  const restarted = await create(repo)
  assert.equal(restarted.room.state, 'waiting')
  assert.equal(restarted.room.history.length, 0)
  assert.equal(restarted.room.report, undefined)
  assert.equal(restarted.room.playerIds.length, 1)
})

const OFFLINE_MS = 6 * 60_000

/** 把某个玩家的心跳往前拨，用来构造离线场景，不需要假时钟 */
async function backdate(repo: RoomRepository, playerId: string, ms: number): Promise<void> {
  await repo.withLock(ROOM_CODE, (room) => {
    room.players[playerId].lastSeenAt = Date.now() - ms
  })
}

test('waiting 中一方心跳超时：座位被回收，新玩家补上空出的角色', async () => {
  const {repo, firstId, secondId} = await newRoom()
  await backdate(repo, firstId, OFFLINE_MS)

  const {room, playerId: thirdId} = await join(ROOM_CODE, repo)
  assert.equal(room.playerIds.length, 2, '离线座位被回收后仍只有两人')
  assert.equal(room.players[firstId], undefined, '离线玩家的座位已释放')
  // 座位可回收后不能再用人数推断角色，否则会产出两个 b
  assert.equal(room.players[thirdId].role, 'a')
  assert.equal(room.players[thirdId].name, '用户A')
  assert.equal(room.players[secondId].role, 'b')
})

test('playing 中一方心跳超时：本局判定结束且不生成报告', async () => {
  let summarized = false
  const ai = makeAi()
  const watching: GameAi = {
    ...ai,
    async summarize(input) {
      summarized = true
      return ai.summarize(input)
    },
  }
  const {repo, firstId, secondId} = await newRoom()
  await startGame(ROOM_CODE, ai, repo)
  await backdate(repo, secondId, OFFLINE_MS)

  const room = await getRoom(ROOM_CODE, repo, firstId)
  assert.ok(room)
  assert.equal(room.state, 'finished')
  assert.equal(room.abandoned, true)
  assert.equal(room.report, undefined)
  assert.match(room.endingReason, /离开/)

  const retried = await retryAi(ROOM_CODE, watching, repo)
  assert.equal(retried.report, undefined)
  assert.equal(summarized, false, '历史残缺的局不应调用 AI 总结')
})

test('主动退出：waiting 立刻释放座位，playing 直接结束本局', async () => {
  const waiting = await newRoom()
  const afterLeave = await leave(ROOM_CODE, waiting.firstId, waiting.repo)
  assert.equal(afterLeave.state, 'waiting')
  assert.equal(afterLeave.playerIds.length, 1)
  assert.equal(afterLeave.players[waiting.firstId], undefined)
  // 退出后空出的座位可以立即被新玩家占用
  const rejoined = await join(ROOM_CODE, waiting.repo)
  assert.equal(rejoined.room.playerIds.length, 2)

  const playing = await newRoom()
  await startGame(ROOM_CODE, makeAi(), playing.repo)
  const abandoned = await leave(ROOM_CODE, playing.secondId, playing.repo)
  assert.equal(abandoned.state, 'finished')
  assert.equal(abandoned.abandoned, true)
  assert.equal(abandoned.report, undefined)
})

test('双方都掉线后可以重新创建房间，不再报房间已满', async () => {
  const {repo, firstId, secondId} = await newRoom()
  await startGame(ROOM_CODE, makeAi(), repo)
  await backdate(repo, firstId, OFFLINE_MS)
  await backdate(repo, secondId, OFFLINE_MS)

  const created = await create(repo)
  assert.equal(created.room.state, 'waiting')
  assert.equal(created.room.playerIds.length, 1, '重开后只剩创建者一人')
  assert.equal(created.room.abandoned, false)
  assert.equal(created.room.history.length, 0)
})

test('心跳按节流窗口落库：窗口内重复轮询不写心跳', async () => {
  const {repo, firstId} = await newRoom()

  await backdate(repo, firstId, 10_000)
  const within = (await readRoom(repo)).players[firstId].lastSeenAt
  await getRoom(ROOM_CODE, repo, firstId)
  assert.equal((await readRoom(repo)).players[firstId].lastSeenAt, within, '30 秒窗口内不刷新')

  await backdate(repo, firstId, 40_000)
  await getRoom(ROOM_CODE, repo, firstId)
  const refreshed = (await readRoom(repo)).players[firstId].lastSeenAt
  assert.ok(refreshed > Date.now() - 5_000, '超过窗口后刷新为当前时间')
})

test('提交回合本身算存活证明，不会被判成离线', async () => {
  const ai = makeAi()
  const {repo, firstId, secondId} = await newRoom()
  await startGame(ROOM_CODE, ai, repo)
  await backdate(repo, firstId, OFFLINE_MS)

  // 心跳先记后回收：提交者即使心跳过期也不应被自己的请求判离线
  const room = await submitTurn(ROOM_CODE, firstId, {choiceId: 'follow', text: '我还在'}, ai, repo)
  assert.equal(room.state, 'playing')
  assert.equal(room.abandoned, false)
  assert.equal(room.submissions[firstId].text, '我还在')
  assert.ok(room.players[secondId], '对方座位不受影响')
})
