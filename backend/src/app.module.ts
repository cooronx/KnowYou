import {Module} from '@nestjs/common'
import {ConfigModule} from '@nestjs/config'
import {AiModule} from './modules/ai/ai.module.ts'
import {AuthModule} from './modules/auth/auth.module.ts'
import {HealthController} from './modules/health/health.controller.ts'
import {PrismaModule} from './modules/prisma/prisma.module.ts'
import {RoomsModule} from './modules/rooms/rooms.module.ts'

@Module({
  imports: [ConfigModule.forRoot({isGlobal: true}), PrismaModule, AiModule, RoomsModule, AuthModule],
  controllers: [HealthController],
})
export class AppModule {}
