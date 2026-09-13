import {Injectable, type OnModuleDestroy} from '@nestjs/common'
import type {PrismaClient} from '@prisma/client'
import {getPrisma} from '../../prisma.ts'

/**
 * Prisma 客户端由领域层惰性创建，这里只做 Nest 生命周期包装。
 * 首次注入时才读取 DATABASE_URL，避免未配置数据库时启动即失败。
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient = getPrisma()

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect()
  }
}
