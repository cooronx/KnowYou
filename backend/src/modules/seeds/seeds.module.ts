import {Module, type Provider} from '@nestjs/common'
import {createPrismaSeedRepository} from '../../seed-repository-prisma.ts'
import {AiModule} from '../ai/ai.module.ts'
import {PrismaService} from '../prisma/prisma.service.ts'
import {SeedsController} from './seeds.controller.ts'
import {SeedsService} from './seeds.service.ts'
import {SEED_REPOSITORY} from './seeds.tokens.ts'

const seedRepositoryProvider: Provider = {
  provide: SEED_REPOSITORY,
  useFactory: (prisma: PrismaService) => createPrismaSeedRepository(() => prisma.client),
  inject: [PrismaService],
}

@Module({
  imports: [AiModule],
  controllers: [SeedsController],
  providers: [SeedsService, seedRepositoryProvider],
  exports: [SeedsService],
})
export class SeedsModule {}
