import {PrismaPg} from '@prisma/adapter-pg'
import {PrismaClient} from '@prisma/client'

// Next.js 开发模式下模块会被反复热重载，用 globalThis 缓存避免连接池随之泄漏
const globalForPrisma = globalThis as {prisma?: PrismaClient}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL?.trim()
  if (!connectionString) throw new Error('数据库未配置：请在 .env 中设置 DATABASE_URL')
  return new PrismaClient({adapter: new PrismaPg({connectionString})})
}

/** 延迟创建客户端：模块加载期不读 DATABASE_URL，避免未配置数据库时 next build 直接失败 */
export function getPrisma(): PrismaClient {
  const client = globalForPrisma.prisma ?? createClient()
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client
  return client
}
