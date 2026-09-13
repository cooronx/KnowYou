import type {RoomRepository} from './room-repository.ts'
import {callRpc, getRdb, unwrap} from './rdb.ts'
import {
  type AiStatus,
  type Choice,
  type Room,
  type RoomState,
  type StoryEntry,
  type Submission,
} from './room-types.ts'
import type {PlayerRole} from './story.ts'

/** PostgREST 行结构：JSONB 与枚举都按领域类型原样返回 */
type RoomRow = {
  code: string
  state: RoomState
  round: number
  narration: string
  scene: string
  isEnding: boolean
  endingReason: string
  aiStatus: AiStatus
  aiError: string
  choices: Choice[]
  submissions: Record<string, Submission>
  version: number
}
type PlayerRow = {id: string; name: string; role: PlayerRole; seat: number}
type TurnRow = {round: number; entries: StoryEntry[]; narration: string}
type ReportRow = {common: string[]; differences: string[]; complement: string; topics: string[]}

function toRoom(room: RoomRow, players: PlayerRow[], turns: TurnRow[], report?: ReportRow): Room {
  const playersById: Room['players'] = {}
  for (const player of players) {
    playersById[player.id] = {name: player.name, role: player.role}
  }
  return {
    code: room.code,
    state: room.state,
    playerIds: players.map((player) => player.id),
    players: playersById,
    round: room.round,
    narration: room.narration,
    scene: room.scene,
    choices: room.choices,
    submissions: room.submissions,
    history: turns.map((turn) => ({
      round: turn.round,
      entries: turn.entries,
      narration: turn.narration,
    })),
    isEnding: room.isEnding,
    endingReason: room.endingReason,
    aiStatus: room.aiStatus,
    aiError: room.aiError,
    report: report
      ? {
          common: report.common,
          differences: report.differences,
          complement: report.complement,
          topics: report.topics,
        }
      : undefined,
  }
}

/** 读快照；version 不进入领域模型，只在提交时用作乐观锁校验 */
async function readSnapshot(code: string): Promise<{room: Room; version: number} | undefined> {
  const rdb = getRdb()
  const [rooms, players, turns, reports] = await Promise.all([
    unwrap<RoomRow>(rdb.from('Room').select('*').eq('code', code)),
    unwrap<PlayerRow>(rdb.from('Player').select('*').eq('roomCode', code).order('seat')),
    unwrap<TurnRow>(rdb.from('Turn').select('*').eq('roomCode', code).order('round')),
    unwrap<ReportRow>(rdb.from('Report').select('*').eq('roomCode', code)),
  ])
  if (rooms.length === 0) return undefined
  return {room: toRoom(rooms[0], players, turns, reports[0]), version: rooms[0].version}
}

/**
 * 把 before/after 两份快照的差异整理成 DB 函数 knowyou_apply_room_change 的载荷。
 * 语义与旧的 Prisma persist 一致：只写入变化的关联数据，history 追加或整体清空。
 */
function buildChange(before: Room, after: Room) {
  const newPlayers = after.playerIds
    .filter((id) => !before.players[id])
    .map((id) => ({
      id,
      name: after.players[id].name,
      role: after.players[id].role,
      seat: after.playerIds.indexOf(id),
    }))

  const newTurns = after.history
    .filter((turn) => !before.history.some((old) => old.round === turn.round))
    .map((turn) => ({
      id: crypto.randomUUID(),
      round: turn.round,
      entries: turn.entries,
      narration: turn.narration,
    }))

  return {
    room: {
      state: after.state,
      round: after.round,
      narration: after.narration,
      scene: after.scene,
      isEnding: after.isEnding,
      endingReason: after.endingReason,
      aiStatus: after.aiStatus,
      aiError: after.aiError,
      choices: after.choices,
      submissions: after.submissions,
    },
    newPlayers,
    newTurns,
    // history 只会追加，或在开新局时被清空
    deleteTurnsAfterRound: after.history.length < before.history.length ? after.history.length : null,
    reportUpsert: after.report ?? null,
    reportDelete: !after.report && Boolean(before.report),
  }
}

/** 乐观锁冲突时的最大重试次数；mutate 是纯内存操作，重试成本很低 */
const MAX_WRITE_ATTEMPTS = 5

export function createRdbRoomRepository(): RoomRepository {
  return {
    async find(code) {
      return (await readSnapshot(code))?.room
    },

    async ensureRoom(code) {
      await callRpc('knowyou_ensure_room', {p_code: code})
    },

    /** 复用 room-store 的说明：mutate 必须同步，AI 等外部调用放在两次 withLock 之间 */
    async withLock(code, mutate) {
      for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
        const snapshot = await readSnapshot(code)
        if (!snapshot) throw new Error('房间不存在')

        const before = snapshot.room
        const after = structuredClone(before)
        const result = mutate(after)

        const applied = await callRpc<{ok: boolean; reason?: string}>('knowyou_apply_room_change', {
          p_code: code,
          p_expected_version: snapshot.version,
          p_change: buildChange(before, after),
        })
        if (applied.ok) return result
        if (applied.reason === 'not_found') throw new Error('房间不存在')
        // version 冲突：期间有并发写成功提交，基于新快照重新执行 mutate
      }
      throw new Error('房间写入冲突，请重试')
    },
  }
}
