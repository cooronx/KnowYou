import type {Room, Report, StoryEntry, TurnRecord} from '@/types'

export const demoRoomPreview = {
  code: 'KY-2048',
  round: '02 / 04',
  scene: '暴雨夜，桥的另一端',
  narration: '你们在山城车站醒来。唯一的出口正在涨水，远处有人呼救。',
  chips: ['风险偏好', '护己 / 护人', '镜像提问'],
  branches: [
    {label: 'A', title: '先救人', detail: '立刻涉水，时间最重要。'},
    {label: 'B', title: '找路', detail: '先确认桥体结构，再行动。'},
    {label: 'C', title: '分头', detail: '一人救援，一人寻找出口。'},
  ],
  players: [
    {name: '你', state: '已提交', submitted: true},
    {name: '虚拟对手', state: '等待中', submitted: false},
  ],
  timer: '180s',
}

const firstRoundEntries: StoryEntry[] = [
  {
    playerId: 'p1',
    name: '你',
    role: 'a',
    choiceId: 'search',
    choiceTitle: '先搜海报墙',
    text: '让虚拟对手留意走廊，我先看看墙上的旧海报。',
  },
  {
    playerId: 'p2',
    name: '虚拟对手',
    role: 'b',
    choiceId: 'follow',
    choiceTitle: '跟上脚步',
    text: '我去前面确认那个脚步声，你随时跟上。',
  },
]

const firstRound: TurnRecord = {
  round: 1,
  entries: firstRoundEntries,
  narration: '你们先分头确认了走廊两端。海报墙后藏着半张被水浸过的值班表，上面圈着档案室的名字。',
}

export const demoHistory: TurnRecord[] = [
  firstRound,
  {
    round: 2,
    entries: [
      {playerId: 'p1', name: '你', role: 'a', choiceId: 'b', choiceTitle: '找路', text: '先确认桥体结构，再决定要不要涉水。'},
      {playerId: 'p2', name: '虚拟对手', role: 'b', choiceId: 'a', choiceTitle: '先救人', text: '水还在涨，我先过去，你把绳子系牢。'},
    ],
    narration: '你们在桥头短暂争执，最后决定由虚拟对手先过去，你留在原地固定绳索。',
  },
]

export const mockRoom: Room = {
  code: 'DEMO01',
  state: 'playing',
  playerIds: ['p1', 'p2'],
  players: {
    p1: {name: '你', role: 'a', lastSeenAt: Date.now()},
    p2: {name: '虚拟对手', role: 'b', lastSeenAt: Date.now()},
  },
  round: 3,
  scene: '暴雨夜，桥的另一端',
  narration: '你们确认了桥体还能支撑一次通行。水位继续上涨，远处的呼救声忽远忽近。',
  choices: [
    {id: 'rescue', title: '先救人'},
    {id: 'route', title: '找路'},
    {id: 'split', title: '分头行动'},
  ],
  submissions: {},
  history: demoHistory,
  isEnding: false,
  endingReason: '',
  aiStatus: 'idle',
  aiError: '',
  abandoned: false,
}

export const mockReport: Report = {
  common: [
    '都愿意为重要的人承担不确定性。',
    '面对未知时，你们都会先确认彼此的判断，再决定下一步。',
    '你们都选择把分歧留在剧情里解决，而不是回避它。',
  ],
  differences: [
    '你更快做决定，虚拟对手更习惯先确认信息。',
    '你倾向直接行动，虚拟对手更倾向为彼此留好退路。',
  ],
  complement: '冲动与谨慎组成了更完整的行动方案：一个人负责向前，一个人负责别丢下彼此。',
  topics: [
    '如果没有时间限制，你会怎么选？',
    '当对方的选择和你相反时，你最在意的是什么？',
    '下一次，你希望由谁来主导决定？',
  ],
}
