import {defaultStory, type PlayerRole, type StoryOutline} from './story.ts'

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
  // 本局绑定的剧本大纲快照，开局时写入，保证一局内稳定
  outline: StoryOutline
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

export function freshRoom(code: string): Room {
  return {
    code,
    state: 'waiting',
    playerIds: [],
    players: {},
    outline: defaultStory,
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
