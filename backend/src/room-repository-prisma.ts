import {Prisma, type PrismaClient} from '@prisma/client'
import type {RoomRepository} from './room-repository.ts'
import {
  type AiStatus,
  type Choice,
  type Report,
  type Room,
  type RoomState,
  type StoryEntry,
  type Submission,
  type TurnRecord,
} from './room-types.ts'
import {defaultStory, type PlayerRole, type StoryOutline} from './story.ts'

type Tx = Prisma.TransactionClient

const roomInclude = {
  players: {orderBy: {seat: 'asc'}},
  turns: {orderBy: {round: 'asc'}},
  report: true,
} satisfies Prisma.RoomInclude

type RoomRow = Prisma.RoomGetPayload<{include: typeof roomInclude}>

function toRoom(row: RoomRow): Room {
  const players: Room['players'] = {}
  for (const player of row.players) {
    players[player.id] = {name: player.name, role: player.role as PlayerRole}
  }
  return {
    code: row.code,
    state: row.state as RoomState,
    playerIds: row.players.map((player) => player.id),
    players,
    outline: (row.outline as StoryOutline | null) ?? defaultStory,
    round: row.round,
    narration: row.narration,
    scene: row.scene,
    choices: row.choices as Choice[],
    submissions: row.submissions as Record<string, Submission>,
    history: row.turns.map((turn) => ({
      round: turn.round,
      entries: turn.entries as StoryEntry[],
      narration: turn.narration,
    })),
    isEnding: row.isEnding,
    endingReason: row.endingReason,
    aiStatus: row.aiStatus as AiStatus,
    aiError: row.aiError,
    report: row.report
      ? {
          common: row.report.common,
          differences: row.report.differences,
          complement: row.report.complement,
          topics: row.report.topics,
        }
      : undefined,
  }
}

async function persist(tx: Tx, before: Room, after: Room): Promise<void> {
  await tx.room.update({
    where: {code: after.code},
    data: {
      state: after.state,
      round: after.round,
      narration: after.narration,
      scene: after.scene,
      isEnding: after.isEnding,
      endingReason: after.endingReason,
      aiStatus: after.aiStatus,
      aiError: after.aiError,
      outline: after.outline as unknown as Prisma.InputJsonValue,
      choices: after.choices as unknown as Prisma.InputJsonValue,
      submissions: after.submissions as unknown as Prisma.InputJsonValue,
    },
  })

  const newPlayers = after.playerIds.filter((id) => !before.players[id])
  if (newPlayers.length > 0) {
    await tx.player.createMany({
      data: newPlayers.map((id) => ({
        id,
        roomCode: after.code,
        name: after.players[id].name,
        role: after.players[id].role,
        seat: after.playerIds.indexOf(id),
      })),
    })
  }

  // history 只会追加，或在开新局时被清空
  if (after.history.length < before.history.length) {
    await tx.turn.deleteMany({where: {roomCode: after.code, round: {gt: after.history.length}}})
  }
  const newTurns = after.history.filter(
    (turn: TurnRecord) => !before.history.some((old) => old.round === turn.round),
  )
  if (newTurns.length > 0) {
    await tx.turn.createMany({
      data: newTurns.map((turn) => ({
        roomCode: after.code,
        round: turn.round,
        entries: turn.entries as unknown as Prisma.InputJsonValue,
        narration: turn.narration,
      })),
    })
  }

  if (after.report) {
    await upsertReport(tx, after.code, after.report)
  } else if (before.report) {
    await tx.report.delete({where: {roomCode: after.code}})
  }
}

async function upsertReport(tx: Tx, code: string, report: Report): Promise<void> {
  const data = {
    common: report.common,
    differences: report.differences,
    complement: report.complement,
    topics: report.topics,
  }
  await tx.report.upsert({where: {roomCode: code}, create: {roomCode: code, ...data}, update: data})
}

/** getClient 是惰性的：客户端在首次真正访问数据库时才创建 */
export function createPrismaRoomRepository(getClient: () => PrismaClient): RoomRepository {
  return {
    async find(code) {
      const prisma = getClient()
      const row = await prisma.room.findUnique({where: {code}, include: roomInclude})
      return row ? toRoom(row) : undefined
    },

    async ensureRoom(code) {
      const prisma = getClient()
      const existing = await prisma.room.findUnique({where: {code}, select: {state: true}})
      if (!existing) {
        // 并发创建同一个房间码时忽略唯一键冲突，双方都能继续走 join
        await prisma.room.createMany({data: [{code}], skipDuplicates: true})
        return
      }
      // 固定测试房间：已结束的房间允许重新开一局，级联删除玩家、回合与总结
      if (existing.state === 'finished') {
        await prisma.$transaction(async (tx) => {
          await tx.room.delete({where: {code}})
          await tx.room.create({data: {code}})
        })
      }
    },

    async withLock(code, mutate) {
      return getClient().$transaction(async (tx) => {
        // 行锁串行化同一房间的并发提交，保证"两人都提交"只被判定一次
        const locked = await tx.$queryRaw<{code: string}[]>(
          Prisma.sql`SELECT code FROM "Room" WHERE code = ${code} FOR UPDATE`,
        )
        if (locked.length === 0) throw new Error('房间不存在')

        // 事务内必须逐条读关联，不能用 include：Prisma 7 的查询计划会在同一连接上并发发查询，
        // 触发 pg 的 "client is already executing a query" 弃用警告（pg@9 起会直接报错）
        const roomRow = await tx.room.findUniqueOrThrow({where: {code}})
        const players = await tx.player.findMany({where: {roomCode: code}, orderBy: {seat: 'asc'}})
        const turns = await tx.turn.findMany({where: {roomCode: code}, orderBy: {round: 'asc'}})
        const report = await tx.report.findUnique({where: {roomCode: code}})
        const before = toRoom({...roomRow, players, turns, report})
        const after = structuredClone(before)
        // mutate 必须同步，避免在持锁期间等待 AI 等外部调用
        const result = mutate(after)
        await persist(tx, before, after)
        return result
      })
    },
  }
}
