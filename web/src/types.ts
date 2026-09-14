export type PlayerRole = 'a' | 'b'

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

export type StoryOutline = {
  id: string
  title: string
  summary: string
  tags: string[]
  opening: string
  premise: string
  setting: string
  characters: StoryCharacter[]
  endingHint: string
}

export type Room = {
  code: string
  state: 'waiting' | 'playing' | 'finished'
  playerIds: string[]
  // lastSeenAt 是后端心跳写入的 epoch ms
  players: Record<string, {name: string; role: PlayerRole; lastSeenAt: number}>
  // 后端开局绑定的剧本大纲快照；旧数据缺失时回退到本地演示剧本
  outline?: StoryOutline
  round: number
  narration: string
  scene: string
  choices: Choice[]
  submissions: Record<string, Submission>
  history: TurnRecord[]
  isEnding: boolean
  endingReason: string
  aiStatus: 'idle' | 'pending' | 'error'
  aiError: string
  // 一方掉线或退出导致本局提前结束，此时没有报告
  abandoned: boolean
  report?: Report
}

export type SeedSummary = {
  workId: string
  title: string
  labels: string[]
  description: string
  artwork: string
  tabArtwork: string
}

export type SessionUser = {
  id: string
  zhihuUid: string
  fullname: string
  avatar: string
  headline: string
}

export type StoryCharacter = {
  id: PlayerRole
  name: string
  goal: string
  traits: string
}

/** 与后端保持一致的固定测试剧本展示信息 */
export const story = {
  title: '走廊尽头的钥匙',
  summary: '两名夜班社团成员在旧教学楼寻找一把能打开档案室的钥匙。',
  opening: '凌晨，旧教学楼即将断电。你们在门缝里发现一张纸条：钥匙在最不该出现的地方。',
  characters: [
    {id: 'a', name: '记录员', goal: '确认线索真伪', traits: '谨慎、善于观察'},
    {id: 'b', name: '行动员', goal: '在断电前打开档案室', traits: '果断、敢于冒险'},
  ] as StoryCharacter[],
}

export const MAX_ROUNDS = 8
