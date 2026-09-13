import 'reflect-metadata'
import {NestFactory} from '@nestjs/core'
import cookieParser from 'cookie-parser'
import {AppModule} from './app.module.ts'

/** 支持精确匹配与 `*` 通配（如 https://*.vercel.app），用于带凭证的跨域白名单 */
function originAllowed(origin: string | undefined, allowlist: string[]): boolean {
  if (!origin) return true
  return allowlist.some((pattern) => {
    if (!pattern.includes('*')) return pattern === origin
    const regex = new RegExp(
      `^${pattern
        .split('*')
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*')}$`,
    )
    return regex.test(origin)
  })
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  app.use(cookieParser())
  // 前后端分离：前端在独立源（iroha.chat / Vercel 预览），需要带凭证的 CORS
  const allowlist = (process.env.CORS_ORIGINS?.trim() || process.env.WEB_APP_URL?.trim() || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      callback(null, originAllowed(origin, allowlist))
    },
    credentials: true,
  })
  app.setGlobalPrefix('api')
  const port = Number(process.env.PORT ?? 3000)
  await app.listen(port, '0.0.0.0')
}

void bootstrap()
