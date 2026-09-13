import {getPrisma} from './prisma.ts'
import {createPrismaRoomRepository} from './room-repository-prisma.ts'

/** 服务端路由统一使用的仓储实例，数据库客户端在首次访问时才创建 */
export const roomRepository = createPrismaRoomRepository(getPrisma)
