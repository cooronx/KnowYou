import {MAX_ROUNDS, story, type PlayerRole, type StoryOutline} from './story.ts'

export const ROOM_CODE = 'DEMO01'
export {MAX_ROUNDS}

export type RoomState = 'waiting' | 'playing' | 'finished'
export type AiStatus = 'idle' | 'pending' | 'error'

export type Choice = {id: string; title: string}
export type Submission = {choiceId: string; text: string}

export type StoryEntry = {
  playerId: string
  name: string
  role: PlayerRole
  choiceId: string
  choiceTitle: string
  text: string
}

export type TurnRecord = {
  round: number
  entries: StoryEntry[]
  narration: string
}

export type Report = {
  common: string[]
  differences: string[]
  complement: string
  topics: string[]
}

export type Room = {
  code: string
  state: RoomState
  playerIds: string[]
  players: Record<string, {name: string; role: PlayerRole}>
  round: number
  narration: string
  scene: string
  choices: Choice[]
  submissions: Record<string, Submission>
  history: TurnRecord[]
  isEnding: boolean
  endingReason: string
  aiStatus: AiStatus
  aiError: string
  report?: Report
}

export type SceneResult = {
  narration: string
  scene: string
  choices: Choice[]
  isEnding: boolean
  endingReason: string
}

export type AdvanceInput = {
  outline: StoryOutline
  round: number
  maxRounds: number
  mustEnd: boolean
  scene: string
  choices: Choice[]
  submissions: StoryEntry[]
  history: TurnRecord[]
}

export type SummaryInput = {
  outline: StoryOutline
  history: TurnRecord[]
}

export interface GameAi {
  revealOpening(outline: StoryOutline): Promise<SceneResult>
  advance(input: AdvanceInput): Promise<SceneResult>
  summarize(input: SummaryInput): Promise<Report>
}

const rooms = new Map<string, Room>()

export function getRoom(code: string): Room | undefined {
  return rooms.get(code)
}

function freshRoom(code: string): Room {
  return {
    code,
    state: 'waiting',
    playerIds: [],
    players: {},
    round: 0,
    narration: '',
    scene: '',
    choices: [],
    submissions: {},
    history: [],
    isEnding: false,
    endingReason: '',
    aiStatus: 'idle',
    aiError: '',
  }
}

export function join(room: Room, name: string): {room: Room; playerId: string} {
  if (room.state !== 'waiting' || room.playerIds.length >= 2) throw new Error('房间已满')
  const playerId = crypto.randomUUID()
  room.playerIds.push(playerId)
  room.players[playerId] = {name: name.trim() || '游客', role: room.playerIds.length === 1 ? 'a' : 'b'}
  return {room, playerId}
}

export function create(name: string): {room: Room; playerId: string} {
  let room = rooms.get(ROOM_CODE)
  // 固定测试房间：已结束的房间允许重新开一局，避免“再来一局”被旧状态卡住
  if (!room || room.state === 'finished') {
    room = freshRoom(ROOM_CODE)
    rooms.set(ROOM_CODE, room)
  }
  return join(room, name)
}

function applyScene(room: Room, scene: SceneResult): void {
  room.narration = scene.narration
  room.scene = scene.scene
  room.choices = scene.choices
  room.isEnding = scene.isEnding
  room.endingReason = scene.endingReason
}

async function revealOpening(room: Room, ai: GameAi): Promise<void> {
  room.aiStatus = 'pending'
  room.aiError = ''
  try {
    const scene = await ai.revealOpening(story)
    applyScene(room, {...scene, isEnding: false, endingReason: ''})
    room.aiStatus = 'idle'
  } catch (error) {
    room.aiStatus = 'error'
    room.aiError = errorMessage(error)
  }
}

export async function startGame(room: Room, ai: GameAi): Promise<void> {
  if (room.state === 'playing' && room.choices.length === 0) {
    await revealOpening(room, ai)
    return
  }
  if (room.state !== 'waiting') throw new Error('游戏已经开始')
  if (room.playerIds.length !== 2) throw new Error('需要两名玩家才能开始')
  room.state = 'playing'
  room.round = 1
  room.submissions = {}
  room.history = []
  room.report = undefined
  await revealOpening(room, ai)
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

async function advance(room: Room, ai: GameAi): Promise<void> {
  if (room.aiStatus === 'pending') return
  const entries = collectEntries(room)
  if (entries.length !== 2) return
  room.aiStatus = 'pending'
  room.aiError = ''
  try {
    const result = await ai.advance({
      outline: story,
      round: room.round,
      maxRounds: MAX_ROUNDS,
      mustEnd: room.round >= MAX_ROUNDS,
      scene: room.scene,
      choices: room.choices,
      submissions: entries,
      history: room.history,
    })
    room.history.push({round: room.round, entries, narration: result.narration})
    room.submissions = {}
    if (result.isEnding || room.round >= MAX_ROUNDS) {
      room.state = 'finished'
      room.isEnding = true
      room.narration = result.narration
      room.endingReason = result.endingReason || '故事达到回合上限，自动收束。'
      room.choices = []
      await generateReport(room, ai)
      return
    }
    room.round += 1
    applyScene(room, result)
    room.aiStatus = 'idle'
  } catch (error) {
    // AI 失败时保留回合和双方提交，等待重试
    room.aiStatus = 'error'
    room.aiError = errorMessage(error)
  }
}

async function generateReport(room: Room, ai: GameAi): Promise<void> {
  room.aiStatus = 'pending'
  room.aiError = ''
  try {
    room.report = await ai.summarize({outline: story, history: room.history})
    room.aiStatus = 'idle'
  } catch (error) {
    room.aiStatus = 'error'
    room.aiError = errorMessage(error)
  }
}

export async function submitTurn(
  room: Room,
  playerId: string,
  submission: Submission,
  ai: GameAi,
): Promise<void> {
  if (room.state !== 'playing') throw new Error('当前不能提交')
  if (!room.players[playerId]) throw new Error('玩家不属于该房间')
  if (room.aiStatus === 'pending') throw new Error('AI 正在推进剧情，请稍候')
  // 重复提交直接忽略，客户端轮询后会看到最新状态
  if (room.submissions[playerId]) return
  const choice = room.choices.find((item) => item.id === submission.choiceId)
  if (!choice) throw new Error('选择无效')
  const text = (submission.text ?? '').trim()
  if (text.length > 120) throw new Error('行动文字不能超过 120 字')
  room.submissions[playerId] = {choiceId: choice.id, text}
  if (Object.keys(room.submissions).length === 2) await advance(room, ai)
}

export async function retryAi(room: Room, ai: GameAi): Promise<void> {
  if (room.aiStatus === 'pending') return
  if (room.state === 'playing' && room.choices.length === 0) {
    await revealOpening(room, ai)
    return
  }
  if (room.state === 'playing' && collectEntries(room).length === 2) {
    await advance(room, ai)
    return
  }
  if (room.state === 'finished' && !room.report) {
    await generateReport(room, ai)
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'AI 调用失败，请重试'
}

export {rooms}
