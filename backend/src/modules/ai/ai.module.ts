import {Module} from '@nestjs/common'
import {openAiGameAi} from '../../ai.ts'
import {GAME_AI} from './ai.tokens.ts'

@Module({
  providers: [{provide: GAME_AI, useValue: openAiGameAi}],
  exports: [GAME_AI],
})
export class AiModule {}
