import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common'
import type {Room} from '../../room-types.ts'
import {RoomsService} from './rooms.service.ts'

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

type TurnBody = {playerId?: unknown; choiceId?: unknown; text?: unknown}
type StartBody = {workId?: unknown}

@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Post()
  async create(): Promise<{code: string; playerId: string}> {
    try {
      const {room, playerId} = await this.rooms.create()
      return {code: room.code, playerId}
    } catch (error) {
      throw new BadRequestException({error: errorMessage(error, '加入失败')})
    }
  }

  @Get(':code')
  async find(@Param('code') code: string): Promise<Room> {
    const room = await this.rooms.find(code)
    if (!room) throw new NotFoundException({error: '房间不存在'})
    return room
  }

  @Post(':code/join')
  async join(@Param('code') code: string): Promise<{code: string; playerId: string}> {
    try {
      const {room, playerId} = await this.rooms.join(code)
      return {code: room.code, playerId}
    } catch (error) {
      throw new BadRequestException({error: errorMessage(error, '加入失败')})
    }
  }

  @Post(':code/start')
  async start(@Param('code') code: string, @Body() body: StartBody): Promise<Room> {
    try {
      const workId = typeof body?.workId === 'string' ? body.workId : undefined
      return await this.rooms.start(code, workId)
    } catch (error) {
      throw new BadRequestException({error: errorMessage(error, '开始失败')})
    }
  }

  @Post(':code/turn')
  async turn(@Param('code') code: string, @Body() body: TurnBody): Promise<Room> {
    try {
      if (typeof body?.playerId !== 'string' || typeof body?.choiceId !== 'string') {
        throw new Error('请求缺少 playerId 或 choiceId')
      }
      return await this.rooms.submit(code, body.playerId, {
        choiceId: body.choiceId,
        text: typeof body.text === 'string' ? body.text : '',
      })
    } catch (error) {
      throw new BadRequestException({error: errorMessage(error, '提交失败')})
    }
  }

  @Post(':code/retry')
  async retry(@Param('code') code: string): Promise<Room> {
    try {
      return await this.rooms.retry(code)
    } catch (error) {
      throw new BadRequestException({error: errorMessage(error, '重试失败')})
    }
  }
}
