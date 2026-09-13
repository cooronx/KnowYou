import 'dotenv/config'
import {defineConfig} from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // 不用 env() 助手：它在变量缺失时抛错，会让不需要数据库的 prisma generate（如 CI 类型检查）失败
    url: process.env.DATABASE_URL ?? '',
  },
})
