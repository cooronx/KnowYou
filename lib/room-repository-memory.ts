import type {RoomRepository} from './room-repository.ts'
import {freshRoom, type Room} from './room-types.ts'

/** 测试和本地调试用的内存实现，语义与 rdb 实现保持一致 */
export function createMemoryRoomRepository(): RoomRepository {
  const rooms = new Map<string, Room>()
  return {
    async find(code) {
      const room = rooms.get(code)
      return room ? structuredClone(room) : undefined
    },
    async ensureRoom(code) {
      const room = rooms.get(code)
      // 固定测试房间：已结束的房间允许重新开一局，避免"再来一局"被旧状态卡住
      if (!room || room.state === 'finished') rooms.set(code, freshRoom(code))
    },
    async withLock(code, mutate) {
      const room = rooms.get(code)
      if (!room) throw new Error('房间不存在')
      // 先在副本上改，成功才提交：mutate 抛错时丢弃改动，与 rdb 的原子提交语义一致
      const draft = structuredClone(room)
      // mutate 是同步函数，Node 单线程下天然独占，无需额外排队
      const result = mutate(draft)
      rooms.set(code, draft)
      return result
    },
  }
}
