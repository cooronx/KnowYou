import type {RoomRepository} from './room-repository.ts'
import {
  type AdvanceInput,
  type GameAi,
  type Room,
  type SceneResult,
  type StoryEntry,
  type Submission,
} from './room-types.ts'
import {MAX_ROUNDS, type StoryOutline} from './story.ts'

export const ROOM_CODE = 'DEMO01'
export {MAX_ROUNDS}
export type * from './room-types.ts'

function snapshot(room: Room): Room {
  return structuredClone(room)
}

async function currentRoom(code: string, repo: RoomRepository): Promise<Room> {
  const room = await repo.find(code)
  if (!room) throw new Error('房间不存在')
  return room
}

export function getRoom(code: string, repo: RoomRepository): Promise<Room | undefined> {
  return repo.find(code)
}

export async function join(code: string, repo: RoomRepository): Promise<{room: Room; playerId: string}> {
  return repo.withLock(code, (room) => {
    if (room.state !== 'waiting' || room.playerIds.length >= 2) throw new Error('房间已满')
    const playerId = crypto.randomUUID()
    room.playerIds.push(playerId)
    const isFirst = room.playerIds.length === 1
    room.players[playerId] = {name: isFirst ? '用户A' : '用户B', role: isFirst ? 'a' : 'b'}
    return {room: snapshot(room), playerId}
  })
}

export async function create(repo: RoomRepository): Promise<{room: Room; playerId: string}> {
  await repo.ensureRoom(ROOM_CODE)
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
    // 开场生成失败后重新点击开始：房间已在 playing 但还没有选择，直接重新生成开场
    if (room.state === 'playing' && room.choices.length === 0) return
    if (room.state !== 'waiting') throw new Error('游戏已经开始')
    if (room.playerIds.length !== 2) throw new Error('需要两名玩家才能开始')
    // 绑定本局剧本快照；未指定时沿用房间默认大纲
    if (outline) room.outline = outline
    room.state = 'playing'
    room.round = 1
    room.submissions = {}
    room.history = []
    room.report = undefined
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
  const room = await currentRoom(code, repo)
  if (room.aiStatus === 'pending') return room
  if (room.state === 'playing' && room.choices.length === 0) return revealOpening(code, ai, repo)
  if (room.state === 'playing' && collectEntries(room).length === 2) return advance(code, ai, repo)
  if (room.state === 'finished' && !room.report) return generateReport(code, ai, repo)
  return room
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'AI 调用失败，请重试'
}
