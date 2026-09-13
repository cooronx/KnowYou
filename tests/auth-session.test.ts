/**
 * 会话与 state 的集成测试，走 CloudBase HTTP 通道打到云数据库。
 * 未配置 CLOUDBASE_ENV_ID / CLOUDBASE_API_KEY 时整体跳过。
 */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {
  SESSION_COOKIE,
  consumeOauthState,
  createOauthState,
  createSession,
  destroySession,
  readSession,
  sessionCookieOptions,
} from '../lib/auth-session.ts'
import {getRdb, unwrap} from '../lib/rdb.ts'
import type {ZhihuUserProfile} from '../lib/zhihu-oauth.ts'

const hasCloudbase = Boolean(
  process.env.CLOUDBASE_ENV_ID?.trim() && process.env.CLOUDBASE_API_KEY?.trim(),
)

// uid 取 int64 边界值，验证全链路以字符串存储
const profile: ZhihuUserProfile = {
  zhihuUid: '969570047710216200',
  hashId: 'hash-abc',
  fullname: '测试用户',
  avatar: 'https://picx.zhimg.com/test.jpg',
  headline: '一句话介绍',
}

const oauth = {accessToken: 'oauth-token-secret', expiresInSeconds: 3600}

test('会话与 state 集成测试（CloudBase）', {skip: hasCloudbase ? false : '未配置 CLOUDBASE_*'}, async (t) => {
  const rdb = getRdb()
  const createdStates: string[] = []

  // 只清理测试账号的数据，避免影响环境里的真实用户
  const cleanup = async () => {
    await unwrap(rdb.from('User').delete().eq('zhihuUid', profile.zhihuUid).select()).catch(() => undefined)
    for (const state of createdStates.splice(0)) {
      await unwrap(rdb.from('OauthState').delete().eq('state', state).select()).catch(() => undefined)
    }
  }

  const createState = async () => {
    const state = await createOauthState()
    createdStates.push(state)
    return state
  }

  t.after(cleanup)

  await t.test('state 只能消费一次，重放被拒绝', async () => {
    await cleanup()
    const state = await createState()
    assert.ok(state.length >= 32, 'state 必须足够长')

    assert.equal(await consumeOauthState(state, state), true, '首次校验通过')
    assert.equal(await consumeOauthState(state, state), false, '重复使用被拒绝')
  })

  await t.test('缺失、不匹配的 state 被拒绝', async () => {
    await cleanup()
    const state = await createState()
    assert.equal(await consumeOauthState('', state), false, '空 state 被拒绝')
    assert.equal(await consumeOauthState('not-the-real-state', state), false, '不匹配被拒绝')
    // 未被成功消费的 state 仍然可用
    assert.equal(await consumeOauthState(state, state), true)
  })

  await t.test('不同浏览器会话不能复用登录请求', async () => {
    await cleanup()
    // 攻击者拿到了 Query 里的 state，但自己的浏览器没有对应 Cookie
    const state = await createState()
    assert.equal(await consumeOauthState(state, undefined), false, '缺少 Cookie 被拒绝')
    assert.equal(await consumeOauthState(state, 'other-browser-state'), false, 'Cookie 不匹配被拒绝')
    // 拒绝不得消费掉 state，本人浏览器仍能正常登录
    assert.equal(await consumeOauthState(state, state), true, '发起登录的浏览器仍可完成')
  })

  await t.test('过期 state 被拒绝', async () => {
    await cleanup()
    const expired = `expired-${Date.now()}`
    createdStates.push(expired)
    await unwrap(
      rdb
        .from('OauthState')
        .insert([{state: expired, expiresAt: new Date(Date.now() - 1000).toISOString()}])
        .select(),
    )
    assert.equal(await consumeOauthState(expired, expired), false, '过期 state 被拒绝')
  })

  await t.test('并发回调只有一个能消费同一个 state', async () => {
    await cleanup()
    const state = await createState()
    const results = await Promise.all([
      consumeOauthState(state, state),
      consumeOauthState(state, state),
      consumeOauthState(state, state),
    ])
    assert.equal(results.filter(Boolean).length, 1, '并发下只能有一次成功')
  })

  await t.test('建立会话：uid 无损存储，令牌只存哈希', async () => {
    await cleanup()
    const {token, user} = await createSession(profile, oauth)
    assert.equal(user.zhihuUid, '969570047710216200', 'int64 uid 原样存储')
    assert.equal(user.fullname, '测试用户')

    // 数据库里不能出现会话令牌原值
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const stored = await unwrap<{tokenHash: string}>(rdb.from('Session').select('*').eq('tokenHash', tokenHash))
    assert.equal(stored.length, 1)
    assert.notEqual(tokenHash, token, '数据库存的是哈希而非原值')

    const restored = await readSession(token)
    assert.equal(restored?.id, user.id)
    assert.equal(restored?.zhihuUid, '969570047710216200')
  })

  await t.test('同一知乎账号重复登录复用用户记录并更新资料', async () => {
    await cleanup()
    const first = await createSession(profile, oauth)
    const second = await createSession({...profile, fullname: '改名后'}, oauth)
    assert.equal(second.user.id, first.user.id, 'zhihuUid 唯一，复用同一用户')
    assert.equal(second.user.fullname, '改名后', '资料被更新')
    const users = await unwrap(rdb.from('User').select('*').eq('zhihuUid', profile.zhihuUid))
    assert.equal(users.length, 1)
  })

  await t.test('无效令牌与过期会话都读不到用户', async () => {
    await cleanup()
    assert.equal(await readSession(undefined), undefined)
    assert.equal(await readSession('bogus-token'), undefined)

    const {token, user} = await createSession(profile, oauth)
    await unwrap(
      rdb
        .from('Session')
        .update({expiresAt: new Date(Date.now() - 1000).toISOString()})
        .eq('userId', user.id)
        .select(),
    )
    assert.equal(await readSession(token), undefined, '过期会话失效')
    // 过期会话应被顺带清理
    const left = await unwrap(rdb.from('Session').select('*').eq('userId', user.id))
    assert.equal(left.length, 0)
  })

  await t.test('退出登录后会话立即失效', async () => {
    await cleanup()
    const {token, user} = await createSession(profile, oauth)
    await destroySession(token)
    assert.equal(await readSession(token), undefined)
    const sessions = await unwrap(rdb.from('Session').select('*').eq('userId', user.id))
    assert.equal(sessions.length, 0)
    // 退出不删除用户，下次登录仍复用
    const users = await unwrap(rdb.from('User').select('*').eq('zhihuUid', profile.zhihuUid))
    assert.equal(users.length, 1)
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
