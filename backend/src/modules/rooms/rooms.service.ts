import {Inject, Injectable} from '@nestjs/common'
import type {GameAi, Room, Submission} from '../../room-types.ts'
import type {RoomRepository} from '../../room-repository.ts'
import {create, getRoom, join, retryAi, startGame, submitTurn} from '../../room-store.ts'
import {GAME_AI} from '../ai/ai.tokens.ts'
import {ROOM_REPOSITORY} from './rooms.tokens.ts'

@Injectable()
export class RoomsService {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly repo: RoomRepository,
    @Inject(GAME_AI) private readonly ai: GameAi,
  ) {}

  create(): Promise<{room: Room; playerId: string}> {
    return create(this.repo)
  }

  find(code: string): Promise<Room | undefined> {
    return getRoom(code, this.repo)
  }

  join(code: string): Promise<{room: Room; playerId: string}> {
    return join(code, this.repo)
  }

  start(code: string): Promise<Room> {
    return startGame(code, this.ai, this.repo)
  }

  submit(code: string, playerId: string, submission: Submission): Promise<Room> {
    return submitTurn(code, playerId, submission, this.ai, this.repo)
  }

  retry(code: string): Promise<Room> {
    return retryAi(code, this.ai, this.repo)
  }
}
