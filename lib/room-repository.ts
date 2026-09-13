import type {Room} from './room-types.ts'

/**
 * 房间持久化边界。规则逻辑只依赖这个接口，测试注入内存实现，生产注入 rdb 实现。
 *
 * withLock 的 mutate 必须是同步的纯内存函数：rdb 实现会在读快照后执行它，并把差异提交给
 * DB 函数做版本校验；版本冲突时会基于新快照重跑 mutate，所以函数里不能包含外部调用或副作用。
 * AI 调用一律放在两次 withLock 之间，用 aiStatus === 'pending' 作为跨请求的抢占标记。
 */
export interface RoomRepository {
  /** 读取快照，不加锁，用于对外返回房间状态 */
  find(code: string): Promise<Room | undefined>
  /** 房间不存在时创建；已结束的房间重置为可重开的空房间 */
  ensureRoom(code: string): Promise<void>
  /** 行锁内加载房间、执行 mutate、回写改动，返回 mutate 的结果 */
  withLock<T>(code: string, mutate: (room: Room) => T): Promise<T>
}
