import 'reflect-metadata'
import {NestFactory} from '@nestjs/core'
import cookieParser from 'cookie-parser'
import {AppModule} from './app.module.ts'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  app.use(cookieParser())
  // 前后端分离：前端在独立源（如 localhost:5173 / iroha.chat），需要带凭证的 CORS
  const origins = (process.env.CORS_ORIGINS?.trim() || process.env.WEB_APP_URL?.trim() || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  app.enableCors({origin: origins, credentials: true})
  app.setGlobalPrefix('api')
  const port = Number(process.env.PORT ?? 3000)
  await app.listen(port, '0.0.0.0')
}

void bootstrap()
