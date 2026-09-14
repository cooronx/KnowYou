import {Inject, Injectable} from '@nestjs/common'
import type {GameAi, Room, Submission} from '../../room-types.ts'
import type {RoomRepository} from '../../room-repository.ts'
import {create, getRoom, join, leave, retryAi, startGame, submitTurn} from '../../room-store.ts'
import {GAME_AI} from '../ai/ai.tokens.ts'
import {SeedsService} from '../seeds/seeds.service.ts'
import {ROOM_REPOSITORY} from './rooms.tokens.ts'

@Injectable()
export class RoomsService {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly repo: RoomRepository,
    @Inject(GAME_AI) private readonly ai: GameAi,
    private readonly seeds: SeedsService,
  ) {}

  create(): Promise<{room: Room; playerId: string}> {
    return create(this.repo)
  }

  /** playerId 可选：带上时这次读取同时充当该玩家的在线心跳 */
  find(code: string, playerId?: string): Promise<Room | undefined> {
    return getRoom(code, this.repo, playerId)
  }

  leave(code: string, playerId: string): Promise<Room> {
    return leave(code, playerId, this.repo)
  }

  join(code: string): Promise<{room: Room; playerId: string}> {
    return join(code, this.repo)
  }

  async start(code: string, workId?: string): Promise<Room> {
    const outline = await this.seeds.getOutline(workId)
    // 大纲未就绪的剧本不展示也不开局，避免用默认剧本顶替
    if (!outline) throw new Error('该剧本尚未就绪，请选择其他剧本或稍后再试')
    return startGame(code, this.ai, this.repo, outline)
  }

  submit(code: string, playerId: string, submission: Submission): Promise<Room> {
    return submitTurn(code, playerId, submission, this.ai, this.repo)
  }

  retry(code: string): Promise<Room> {
    return retryAi(code, this.ai, this.repo)
  }
}
