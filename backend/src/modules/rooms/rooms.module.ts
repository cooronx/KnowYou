import {Module, type Provider} from '@nestjs/common'
import {createPrismaRoomRepository} from '../../room-repository-prisma.ts'
import {AiModule} from '../ai/ai.module.ts'
import {PrismaService} from '../prisma/prisma.service.ts'
import {SeedsModule} from '../seeds/seeds.module.ts'
import {RoomsController} from './rooms.controller.ts'
import {RoomsService} from './rooms.service.ts'
import {ROOM_REPOSITORY} from './rooms.tokens.ts'

const roomRepositoryProvider: Provider = {
  provide: ROOM_REPOSITORY,
  useFactory: (prisma: PrismaService) => createPrismaRoomRepository(() => prisma.client),
  inject: [PrismaService],
}

@Module({
  imports: [AiModule, SeedsModule],
  controllers: [RoomsController],
  providers: [RoomsService, roomRepositoryProvider],
})
export class RoomsModule {}
