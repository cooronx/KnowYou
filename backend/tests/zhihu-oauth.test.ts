import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildAuthorizeUrl,
  exchangeToken,
  extractUid,
  fetchUserProfile,
  parseUserProfile,
  readCallbackCode,
  type OauthConfig,
} from '../src/zhihu-oauth.ts'

const config: OauthConfig = {
  appId: 'test-app-id',
  appKey: 'test-app-key',
  redirectUri: 'http://localhost:3000/api/auth/callback',
}

/** 替换全局 fetch，返回捕获到的请求以便断言 */
function mockFetch(handler: (url: string, init: RequestInit) => Response) {
  const original = globalThis.fetch
  const calls: {url: string; init: RequestInit}[] = []
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    calls.push({url, init})
    return handler(url, init)
  }) as typeof fetch
  return {calls, restore: () => {globalThis.fetch = original}}
}

function jsonResponse(body: string, status = 200): Response {
  return new Response(body, {status, headers: {'Content-Type': 'application/json'}})
}

test('uid 为 int64 时无损提取，不经过 JSON.parse 的数值', () => {
  // 文档示例值：超过 Number.MAX_SAFE_INTEGER，但恰好能被 double 精确表示
  const raw = '{"uid": 969570047710216200, "fullname": "张三"}'
  assert.equal(extractUid(raw), '969570047710216200')

  // 邻近值就会丢精度。示例值本身 round-trip 正常，正说明依赖 JSON.parse 是碰运气，
  // 必须在原始文本上取值。
  const lossyRaw = '{"uid": 969570047710216207}'
  assert.equal(extractUid(lossyRaw), '969570047710216207', '文本提取保持原样')
  assert.notEqual(
    String((JSON.parse(lossyRaw) as {uid: number}).uid),
    '969570047710216207',
    'JSON.parse 会把该值改写成邻近的可表示数值',
  )

  // 字符串形态的 uid 也要能读
  assert.equal(extractUid('{"uid":"969570047710216200"}'), '969570047710216200')
  assert.equal(extractUid('{"fullname":"无 uid"}'), undefined)
})

test('回调参数以 authorization_code 为主，兼容 code', () => {
  assert.equal(readCallbackCode(new URLSearchParams('authorization_code=abc123')), 'abc123')
  assert.equal(readCallbackCode(new URLSearchParams('code=fallback')), 'fallback')
  // 两者同时存在时以实测主路径为准
  assert.equal(readCallbackCode(new URLSearchParams('authorization_code=main&code=other')), 'main')
  assert.equal(readCallbackCode(new URLSearchParams('')), undefined)
  assert.equal(readCallbackCode(new URLSearchParams('authorization_code=%20%20')), undefined)
})

test('授权 URL 携带必需参数且对 redirect_uri 编码', () => {
  const url = new URL(buildAuthorizeUrl(config, 'state-value'))
  assert.equal(url.origin + url.pathname, 'https://openapi.zhihu.com/authorize')
  assert.equal(url.searchParams.get('app_id'), config.appId)
  assert.equal(url.searchParams.get('response_type'), 'code')
  assert.equal(url.searchParams.get('state'), 'state-value')
  // 取出后应与登记地址逐字符一致
  assert.equal(url.searchParams.get('redirect_uri'), config.redirectUri)
  // app_key 绝不能出现在授权 URL 里
  assert.ok(!url.search.includes(config.appKey), '授权 URL 不能包含 app_key')
})

test('换取 token：表单字段用 code，成功返回 access_token', async () => {
  const mock = mockFetch(() => jsonResponse('{"access_token":"tok-1","token_type":"Bearer","expires_in":7200}'))
  try {
    const result = await exchangeToken(config, 'auth-code-1')
    assert.equal(result.accessToken, 'tok-1')
    assert.equal(result.expiresInSeconds, 7200)

    assert.equal(mock.calls.length, 1)
    assert.equal(mock.calls[0].url, 'https://openapi.zhihu.com/access_token')
    assert.equal(mock.calls[0].init.method, 'POST')
    const body = new URLSearchParams(String(mock.calls[0].init.body))
    // 回调参数叫 authorization_code，但换 token 的表单字段是 code
    assert.equal(body.get('code'), 'auth-code-1')
    assert.equal(body.get('grant_type'), 'authorization_code')
    assert.equal(body.get('app_id'), config.appId)
    assert.equal(body.get('app_key'), config.appKey)
    assert.equal(body.get('redirect_uri'), config.redirectUri, 'redirect_uri 必须与授权时一致')
  } finally {
    mock.restore()
  }
})

test('换取 token：缺少 access_token 时报错，不把响应体写进消息', async () => {
  const mock = mockFetch(() => jsonResponse('{"code":40001,"data":"invalid code"}'))
  try {
    await assert.rejects(() => exchangeToken(config, 'bad'), /40001/)
  } finally {
    mock.restore()
  }

  const httpFail = mockFetch(() => jsonResponse('{"secret_leak":"should-not-appear"}', 401))
  try {
    await assert.rejects(
      () => exchangeToken(config, 'bad'),
      (error: Error) => {
        assert.match(error.message, /HTTP 401/)
        assert.ok(!error.message.includes('should-not-appear'), '错误消息不得回显响应体')
        return true
      },
    )
  } finally {
    httpFail.restore()
  }
})

test('解析用户信息：code 20000 视为成功，不读取敏感字段', () => {
  const profile = parseUserProfile(
    JSON.stringify({
      code: 20000,
      uid: 123456,
      hash_id: 'hash-1',
      fullname: '李四',
      avatar_path: 'https://picx.zhimg.com/a.jpg',
      headline: '一句话',
      email: 'leak@example.com',
      phone_no: '13800000000',
    }),
  )
  assert.equal(profile.zhihuUid, '123456')
  assert.equal(profile.fullname, '李四')
  assert.equal(profile.avatar, 'https://picx.zhimg.com/a.jpg')
  assert.equal(profile.headline, '一句话')
  // email / phone 不进入应用数据
  assert.ok(!Object.keys(profile).includes('email'))
  assert.ok(!Object.keys(profile).includes('phone_no'))
})

test('解析用户信息：缺少 uid 时按业务错误拒绝', () => {
  // 历史错误形态：HTTP 200 + code 404
  assert.throws(() => parseUserProfile('{"code":404,"data":"User don\'t exist"}'), /404/)
  assert.throws(() => parseUserProfile('{}'), /有效的用户标识/)
  assert.throws(() => parseUserProfile('not json'), /合法 JSON/)
})

test('获取用户信息：携带 Bearer token 且字段齐全', async () => {
  const mock = mockFetch(() =>
    jsonResponse('{"uid":969570047710216200,"hash_id":"h","fullname":"王五","avatar_path":"https://x/y.jpg"}'),
  )
  try {
    const profile = await fetchUserProfile('tok-abc')
    assert.equal(profile.zhihuUid, '969570047710216200', '经过完整链路仍保持 int64 精度')
    assert.equal(profile.fullname, '王五')
    assert.equal(mock.calls[0].url, 'https://openapi.zhihu.com/user')
    const headers = mock.calls[0].init.headers as Record<string, string>
    assert.equal(headers.Authorization, 'Bearer tok-abc')
  } finally {
    mock.restore()
  }
})
