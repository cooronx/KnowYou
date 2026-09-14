import {Module} from '@nestjs/common'
import {openAiGameAi, openAiStoryOutline} from '../../ai.ts'
import {GAME_AI, STORY_OUTLINE_AI} from './ai.tokens.ts'

@Module({
  providers: [
    {provide: GAME_AI, useValue: openAiGameAi},
    {provide: STORY_OUTLINE_AI, useValue: openAiStoryOutline},
  ],
  exports: [GAME_AI, STORY_OUTLINE_AI],
})
export class AiModule {}
