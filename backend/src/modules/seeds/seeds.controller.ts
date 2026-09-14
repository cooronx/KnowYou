import {Controller, Get, NotFoundException, Param, Post} from '@nestjs/common'
import type {SeedRecord, SeedSummary} from '../../seed-types.ts'
import {SeedsService} from './seeds.service.ts'

@Controller('seeds')
export class SeedsController {
  constructor(private readonly seeds: SeedsService) {}

  @Get()
  list(): Promise<SeedSummary[]> {
    return this.seeds.listSummaries()
  }

  @Get(':workId')
  async find(@Param('workId') workId: string): Promise<SeedRecord> {
    const seed = await this.seeds.get(workId)
    if (!seed) throw new NotFoundException({error: '剧本种子不存在'})
    return seed
  }

  @Post('sync')
  async sync(): Promise<{count: number}> {
    const summaries = await this.seeds.syncList()
    return {count: summaries.length}
  }
}
