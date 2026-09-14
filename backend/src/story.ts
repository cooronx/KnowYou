export type PlayerRole = 'a' | 'b'

export type StoryCharacter = {
  id: PlayerRole
  name: string
  goal: string
  traits: string
}

export const MAX_ROUNDS = 8

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

/** 提炼大纲的原料：知乎故事列表元数据 + 详情正文 */
export type StorySource = {
  workId: string
  title: string
  labels: string[]
  introduction: string
  content: string
}

export interface StoryOutlineAi {
  extractOutline(source: StorySource): Promise<StoryOutline>
}

/** 内容接口不可用或种子未指定时的兜底剧本，保证 Demo 始终能开一局 */
export const defaultStory: StoryOutline = {
  id: 'test-lost-key',
  title: '走廊尽头的钥匙',
  summary: '两名夜班社团成员在旧教学楼寻找一把能打开档案室的钥匙。',
  tags: ['校园', '悬疑', '合作'],
  opening: '凌晨，旧教学楼即将断电。你们在门缝里发现一张纸条：钥匙在最不该出现的地方。',
  premise: '断电前找到档案室钥匙并弄清留下纸条的人是谁。',
  setting: '旧教学楼',
  characters: [
    {id: 'a', name: '记录员', goal: '确认线索真伪', traits: '谨慎、善于观察'},
    {id: 'b', name: '行动员', goal: '在断电前打开档案室', traits: '果断、敢于冒险'},
  ],
  endingHint: '真相被揭开且两人完成一次共同选择',
}
