/**
 * 会话与 state 的集成测试，需要可用的 Postgres（npm run db:up）。
 * 未设置 DATABASE_URL 时整体跳过。
 */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {PrismaPg} from '@prisma/adapter-pg'
import {PrismaClient} from '@prisma/client'
import {
  SESSION_COOKIE,
  consumeOauthState,
  createOauthState,
  createSession,
  destroySession,
  readSession,
  sessionCookieOptions,
} from '../src/auth-session.ts'
import type {ZhihuUserProfile} from '../src/zhihu-oauth.ts'

const connectionString = process.env.DATABASE_URL?.trim()

// uid 取 int64 边界值，验证全链路以字符串存储
const profile: ZhihuUserProfile = {
  zhihuUid: '969570047710216200',
  hashId: 'hash-abc',
  fullname: '测试用户',
  avatar: 'https://picx.zhimg.com/test.jpg',
  headline: '一句话介绍',
}

const oauth = {accessToken: 'oauth-token-secret', expiresInSeconds: 3600}

test('会话与 state 集成测试', {skip: connectionString ? false : '未设置 DATABASE_URL'}, async (t) => {
  const prisma = new PrismaClient({adapter: new PrismaPg({connectionString: connectionString!})})

  const cleanup = async () => {
    await prisma.session.deleteMany({})
    await prisma.oauthState.deleteMany({})
    await prisma.user.deleteMany({where: {zhihuUid: profile.zhihuUid}})
  }

  t.after(async () => {
    await cleanup()
    await prisma.$disconnect()
  })

  await t.test('state 只能消费一次，重放被拒绝', async () => {
    await cleanup()
    const state = await createOauthState(prisma)
    assert.ok(state.length >= 32, 'state 必须足够长')

    assert.equal(await consumeOauthState(prisma, state, state), true, '首次校验通过')
    assert.equal(await consumeOauthState(prisma, state, state), false, '重复使用被拒绝')
  })

  await t.test('缺失、不匹配的 state 被拒绝', async () => {
    await cleanup()
    const state = await createOauthState(prisma)
    assert.equal(await consumeOauthState(prisma, '', state), false, '空 state 被拒绝')
    assert.equal(await consumeOauthState(prisma, 'not-the-real-state', state), false, '不匹配被拒绝')
    // 未被成功消费的 state 仍然可用
    assert.equal(await consumeOauthState(prisma, state, state), true)
  })

  await t.test('不同浏览器会话不能复用登录请求', async () => {
    await cleanup()
    // 攻击者拿到了 Query 里的 state，但自己的浏览器没有对应 Cookie
    const state = await createOauthState(prisma)
    assert.equal(await consumeOauthState(prisma, state, undefined), false, '缺少 Cookie 被拒绝')
    assert.equal(await consumeOauthState(prisma, state, 'other-browser-state'), false, 'Cookie 不匹配被拒绝')
    // 拒绝不得消费掉 state，本人浏览器仍能正常登录
    assert.equal(await consumeOauthState(prisma, state, state), true, '发起登录的浏览器仍可完成')
  })

  await t.test('过期 state 被拒绝', async () => {
    await cleanup()
    const expired = 'expired-state-value'
    await prisma.oauthState.create({data: {state: expired, expiresAt: new Date(Date.now() - 1000)}})
    assert.equal(await consumeOauthState(prisma, expired, expired), false, '过期 state 被拒绝')
  })

  await t.test('并发回调只有一个能消费同一个 state', async () => {
    await cleanup()
    const state = await createOauthState(prisma)
    const results = await Promise.all([
      consumeOauthState(prisma, state, state),
      consumeOauthState(prisma, state, state),
      consumeOauthState(prisma, state, state),
    ])
    assert.equal(results.filter(Boolean).length, 1, '并发下只能有一次成功')
  })

  await t.test('建立会话：uid 无损存储，令牌只存哈希', async () => {
    await cleanup()
    const {token, user} = await createSession(prisma, profile, oauth)
    assert.equal(user.zhihuUid, '969570047710216200', 'int64 uid 原样存储')
    assert.equal(user.fullname, '测试用户')

    // 数据库里不能出现会话令牌原值
    const stored = await prisma.session.findMany()
    assert.equal(stored.length, 1)
    assert.equal(stored[0].tokenHash, createHash('sha256').update(token).digest('hex'))
    assert.notEqual(stored[0].tokenHash, token, '数据库存的是哈希而非原值')

    const restored = await readSession(prisma, token)
    assert.equal(restored?.id, user.id)
    assert.equal(restored?.zhihuUid, '969570047710216200')
  })

  await t.test('同一知乎账号重复登录复用用户记录并更新资料', async () => {
    await cleanup()
    const first = await createSession(prisma, profile, oauth)
    const second = await createSession(prisma, {...profile, fullname: '改名后'}, oauth)
    assert.equal(second.user.id, first.user.id, 'zhihuUid 唯一，复用同一用户')
    assert.equal(second.user.fullname, '改名后', '资料被更新')
    assert.equal(await prisma.user.count({where: {zhihuUid: profile.zhihuUid}}), 1)
  })

  await t.test('无效令牌与过期会话都读不到用户', async () => {
    await cleanup()
    assert.equal(await readSession(prisma, undefined), undefined)
    assert.equal(await readSession(prisma, 'bogus-token'), undefined)

    const {token} = await createSession(prisma, profile, oauth)
    await prisma.session.updateMany({data: {expiresAt: new Date(Date.now() - 1000)}})
    assert.equal(await readSession(prisma, token), undefined, '过期会话失效')
    // 过期会话应被顺带清理
    assert.equal(await prisma.session.count(), 0)
  })

  await t.test('退出登录后会话立即失效', async () => {
    await cleanup()
    const {token} = await createSession(prisma, profile, oauth)
    await destroySession(prisma, token)
    assert.equal(await readSession(prisma, token), undefined)
    assert.equal(await prisma.session.count(), 0)
    // 退出不删除用户，下次登录仍复用
    assert.equal(await prisma.user.count({where: {zhihuUid: profile.zhihuUid}}), 1)
  })

  await t.test('会话 Cookie 为 HttpOnly，生产环境要求 Secure', async () => {
    const options = sessionCookieOptions(3600)
    assert.equal(SESSION_COOKIE, 'knowyou_session')
    assert.equal(options.httpOnly, true, 'HttpOnly 防止脚本读取')
    assert.equal(options.sameSite, 'lax', 'Lax 允许 OAuth 回调跳转携带 Cookie')
    assert.equal(options.path, '/')

    // NODE_ENV 在类型上是只读的，测试里通过索引签名临时覆盖
    const env = process.env as Record<string, string | undefined>
    const original = env.NODE_ENV
    try {
      env.NODE_ENV = 'production'
      assert.equal(sessionCookieOptions(3600).secure, true, '生产环境必须 Secure')
    } finally {
      env.NODE_ENV = original
    }
  })
})
