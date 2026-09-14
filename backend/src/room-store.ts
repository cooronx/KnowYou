import type {RoomRepository} from './room-repository.ts'
import {
  type AdvanceInput,
  type GameAi,
  type Room,
  type SceneResult,
  type StoryEntry,
  type Submission,
} from './room-types.ts'
import {MAX_ROUNDS, type PlayerRole, type StoryOutline} from './story.ts'

export const ROOM_CODE = 'DEMO01'
export {MAX_ROUNDS}
export type * from './room-types.ts'

/** 超过这个时长没有心跳即视为离线，座位可被回收 */
const OFFLINE_TIMEOUT_MS = 5 * 60_000
/** 心跳落库的节流窗口：前端 1.5 秒轮询一次，不能每次都去抢房间行锁 */
const HEARTBEAT_WRITE_INTERVAL_MS = 30_000

function snapshot(room: Room): Room {
  return structuredClone(room)
}

function isStale(room: Room, playerId: string, now: number): boolean {
  return now - room.players[playerId].lastSeenAt > OFFLINE_TIMEOUT_MS
}

/** 只读判断：房间里是否已有离线座位需要回收，用于决定要不要进锁 */
function needsSweep(room: Room, now: number): boolean {
  if (room.state === 'finished') return false
  return room.playerIds.some((playerId) => isStale(room, playerId, now))
}

function releaseSeats(room: Room, playerIds: string[]): void {
  const removed = new Set(playerIds)
  for (const playerId of removed) {
    delete room.players[playerId]
    delete room.submissions[playerId]
  }
  room.playerIds = room.playerIds.filter((playerId) => !removed.has(playerId))
}

/** 一方离开导致本局提前结束：历史可能为空或残缺，因此不生成报告 */
function abandonGame(room: Room): void {
  room.state = 'finished'
  room.abandoned = true
  room.isEnding = true
  room.endingReason = '一方离开了房间，本局提前结束。'
  room.choices = []
  room.submissions = {}
  room.aiStatus = 'idle'
  room.aiError = ''
}

/**
 * 在 withLock 的 draft 上原地回收离线座位。每个入口的 mutate 开头都调用，
 * 因此不需要额外的后台定时任务。waiting 只释放座位（本局还没开始，另一方可继续等人），
 * playing 则判定本局结束。
 */
function sweepStale(room: Room, now: number): void {
  if (room.state === 'finished') return
  const stale = room.playerIds.filter((playerId) => isStale(room, playerId, now))
  if (stale.length === 0) return
  if (room.state === 'waiting') {
    releaseSeats(room, stale)
    return
  }
  abandonGame(room)
}

/** 玩家的任何一次操作都算存活证明 */
function touch(room: Room, playerId: string, now: number): void {
  const player = room.players[playerId]
  if (player) player.lastSeenAt = now
}

async function currentRoom(code: string, repo: RoomRepository): Promise<Room> {
  const room = await repo.find(code)
  if (!room) throw new Error('房间不存在')
  return room
}

/** 读取房间，必要时先回收离线座位：避免对已经没人的局继续推进或调用 AI */
async function sweptRoom(code: string, repo: RoomRepository): Promise<Room> {
  const room = await currentRoom(code, repo)
  if (!needsSweep(room, Date.now())) return room
  return repo.withLock(code, (draft) => {
    sweepStale(draft, Date.now())
    return snapshot(draft)
  })
}

/**
 * 读取房间快照，并顺带承担在线心跳：传入 playerId 时刷新其 lastSeenAt。
 * 前端复用已有的 1.5 秒轮询，所以这里按 HEARTBEAT_WRITE_INTERVAL_MS 节流，
 * 只在需要落写（心跳过期或有离线座位待回收）时才进房间行锁。
 */
export async function getRoom(
  code: string,
  repo: RoomRepository,
  playerId?: string,
): Promise<Room | undefined> {
  const room = await repo.find(code)
  if (!room) return undefined
  const now = Date.now()
  const player = playerId ? room.players[playerId] : undefined
  const beatDue = player !== undefined && now - player.lastSeenAt >= HEARTBEAT_WRITE_INTERVAL_MS
  if (!beatDue && !needsSweep(room, now)) return room
  return repo.withLock(code, (draft) => {
    const at = Date.now()
    // 先记下自己的心跳再回收，避免把发起请求的人自己判成离线
    if (playerId) touch(draft, playerId, at)
    sweepStale(draft, at)
    return snapshot(draft)
  })
}

export async function join(code: string, repo: RoomRepository): Promise<{room: Room; playerId: string}> {
  return repo.withLock(code, (room) => {
    const now = Date.now()
    sweepStale(room, now)
    if (room.state === 'playing') throw new Error('游戏已经开始')
    if (room.state === 'finished') throw new Error('本局已结束，请重新创建房间')
    if (room.playerIds.length >= 2) throw new Error('房间已满')
    const playerId = crypto.randomUUID()
    room.playerIds.push(playerId)
    // 座位可被回收，不能再用人数推断角色：取当前没被占用的那个
    const taken = new Set(Object.values(room.players).map((player) => player.role))
    const role: PlayerRole = taken.has('a') ? 'b' : 'a'
    room.players[playerId] = {name: role === 'a' ? '用户A' : '用户B', role, lastSeenAt: now}
    return {room: snapshot(room), playerId}
  })
}

/** 主动退出：waiting 立刻释放座位，playing 判定本局结束，不必等心跳超时 */
export async function leave(code: string, playerId: string, repo: RoomRepository): Promise<Room> {
  return repo.withLock(code, (room) => {
    sweepStale(room, Date.now())
    if (!room.players[playerId]) return snapshot(room)
    if (room.state === 'playing') abandonGame(room)
    else if (room.state === 'waiting') releaseSeats(room, [playerId])
    return snapshot(room)
  })
}

export async function create(repo: RoomRepository): Promise<{room: Room; playerId: string}> {
  await repo.ensureRoom(ROOM_CODE)
  // 房间可能卡在 playing 而双方都已离线：先回收一次，让 ensureRoom 的 finished→重置分支生效，
  // 否则用户要点两次「创建房间」才能进来
  const swept = await sweptRoom(ROOM_CODE, repo)
  if (swept.state === 'finished') await repo.ensureRoom(ROOM_CODE)
  return join(ROOM_CODE, repo)
}

function applyScene(room: Room, scene: SceneResult): void {
  room.narration = scene.narration
  room.scene = scene.scene
  room.choices = scene.choices
  room.isEnding = scene.isEnding
  room.endingReason = scene.endingReason
}

function collectEntries(room: Room): StoryEntry[] {
  return room.playerIds
    .filter((playerId) => Boolean(room.submissions[playerId]))
    .map((playerId) => {
      const submission = room.submissions[playerId]
      const choice = room.choices.find((item) => item.id === submission.choiceId)
      const player = room.players[playerId]
      return {
        playerId,
        name: player.name,
        role: player.role,
        choiceId: submission.choiceId,
        choiceTitle: choice?.title ?? submission.choiceId,
        text: submission.text,
      }
    })
}

/** 抢占 AI 调用权：成功返回 true，已有请求在跑返回 false */
function claimAi(room: Room): boolean {
  if (room.aiStatus === 'pending') return false
  room.aiStatus = 'pending'
  room.aiError = ''
  return true
}

async function failAi(code: string, repo: RoomRepository, error: unknown): Promise<Room> {
  return repo.withLock(code, (room) => {
    room.aiStatus = 'error'
    room.aiError = errorMessage(error)
    return snapshot(room)
  })
}

async function revealOpening(code: string, ai: GameAi, repo: RoomRepository): Promise<Room> {
  const outline = await repo.withLock(code, (room): StoryOutline | null => {
    if (!claimAi(room)) return null
    return room.outline
  })
  if (!outline) return currentRoom(code, repo)
  try {
    const scene = await ai.revealOpening(outline)
    return await repo.withLock(code, (room) => {
      applyScene(room, {...scene, isEnding: false, endingReason: ''})
      room.aiStatus = 'idle'
      return snapshot(room)
    })
  } catch (error) {
    return failAi(code, repo, error)
  }
}

export async function startGame(
  code: string,
  ai: GameAi,
  repo: RoomRepository,
  outline?: StoryOutline,
): Promise<Room> {
  await repo.withLock(code, (room) => {
    sweepStale(room, Date.now())
    // 开场生成失败后重新点击开始：房间已在 playing 但还没有选择，直接重新生成开场
    if (room.state === 'playing' && room.choices.length === 0) return
    if (room.state === 'finished') throw new Error('本局已结束，请重新创建房间')
    if (room.state !== 'waiting') throw new Error('游戏已经开始')
    if (room.playerIds.length !== 2) throw new Error('需要两名玩家才能开始')
    // 绑定本局剧本快照；未指定时沿用房间默认大纲
    if (outline) room.outline = outline
    room.state = 'playing'
    room.round = 1
    room.submissions = {}
    room.history = []
    room.report = undefined
    room.abandoned = false
  })
  return revealOpening(code, ai, repo)
}

async function advance(code: string, ai: GameAi, repo: RoomRepository): Promise<Room> {
  // AI 调用必须在锁外进行，否则 35 秒的请求会一直占住房间行锁
  const input = await repo.withLock(code, (room): AdvanceInput | null => {
    const entries = collectEntries(room)
    if (entries.length !== 2) return null
    if (!claimAi(room)) return null
    return {
      outline: room.outline,
      round: room.round,
      maxRounds: MAX_ROUNDS,
      mustEnd: room.round >= MAX_ROUNDS,
      scene: room.scene,
      choices: room.choices,
      submissions: entries,
      history: room.history,
    }
  })
  if (!input) return currentRoom(code, repo)

  let result: SceneResult
  try {
    result = await ai.advance(input)
  } catch (error) {
    // AI 失败时保留回合和双方提交，等待重试
    return failAi(code, repo, error)
  }

  const {room, finished} = await repo.withLock(code, (room) => {
    // 复用送给 AI 的那份提交，避免与锁外重新读到的状态出现偏差
    room.history.push({round: room.round, entries: input.submissions, narration: result.narration})
    room.submissions = {}
    if (result.isEnding || room.round >= MAX_ROUNDS) {
      room.state = 'finished'
      room.isEnding = true
      room.narration = result.narration
      room.endingReason = result.endingReason || '故事达到回合上限，自动收束。'
      room.choices = []
      // 保持 aiStatus 为 pending，把 AI 调用权交给紧接着的总结生成
      return {room: snapshot(room), finished: true}
    }
    room.round += 1
    applyScene(room, result)
    room.aiStatus = 'idle'
    return {room: snapshot(room), finished: false}
  })
  if (!finished) return room
  return runReport(code, ai, repo)
}

/** 调用方已持有 AI 调用权，直接生成总结 */
async function runReport(code: string, ai: GameAi, repo: RoomRepository): Promise<Room> {
  const room = await currentRoom(code, repo)
  try {
    const report = await ai.summarize({outline: room.outline, history: room.history})
    return await repo.withLock(code, (room) => {
      room.report = report
      room.aiStatus = 'idle'
      return snapshot(room)
    })
  } catch (error) {
    return failAi(code, repo, error)
  }
}

async function generateReport(code: string, ai: GameAi, repo: RoomRepository): Promise<Room> {
  const claimed = await repo.withLock(code, claimAi)
  if (!claimed) return currentRoom(code, repo)
  return runReport(code, ai, repo)
}

export async function submitTurn(
  code: string,
  playerId: string,
  submission: Submission,
  ai: GameAi,
  repo: RoomRepository,
): Promise<Room> {
  const bothSubmitted = await repo.withLock(code, (room) => {
    const now = Date.now()
    // 先记心跳再回收：提交本身就是存活证明，不能把发起请求的人判成离线
    touch(room, playerId, now)
    sweepStale(room, now)
    // 对方离线让本局提前结束：不报错，客户端轮询后会看到终局状态
    if (room.abandoned) return false
    if (room.state !== 'playing') throw new Error('当前不能提交')
    if (!room.players[playerId]) throw new Error('玩家不属于该房间')
    if (room.aiStatus === 'pending') throw new Error('AI 正在推进剧情，请稍候')
    // 重复提交直接忽略，客户端轮询后会看到最新状态
    if (room.submissions[playerId]) return false
    const choice = room.choices.find((item) => item.id === submission.choiceId)
    if (!choice) throw new Error('选择无效')
    const text = (submission.text ?? '').trim()
    if (text.length > 120) throw new Error('行动文字不能超过 120 字')
    room.submissions[playerId] = {choiceId: choice.id, text}
    return Object.keys(room.submissions).length === 2
  })
  if (!bothSubmitted) return currentRoom(code, repo)
  return advance(code, ai, repo)
}

export async function retryAi(code: string, ai: GameAi, repo: RoomRepository): Promise<Room> {
  const room = await sweptRoom(code, repo)
  if (room.aiStatus === 'pending') return room
  if (room.state === 'playing' && room.choices.length === 0) return revealOpening(code, ai, repo)
  if (room.state === 'playing' && collectEntries(room).length === 2) return advance(code, ai, repo)
  // 中途结束的局历史残缺，不生成报告
  if (room.state === 'finished' && !room.report && !room.abandoned) return generateReport(code, ai, repo)
  return room
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'AI 调用失败，请重试'
}
