import {createRdbRoomRepository} from './room-repository-rdb.ts'

/** 服务端路由统一使用的仓储实例，数据通道客户端在首次访问时才创建 */
export const roomRepository = createRdbRoomRepository()
