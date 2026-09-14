import type {Room, SeedSummary, SessionUser} from '@/types'

/** 默认走同源 /api（生产由 Caddy 反代）；如前后端分域名再设置 VITE_API_BASE_URL */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {...(init.headers as Record<string, string> | undefined)}
  if (init.body) headers['Content-Type'] = 'application/json'
  const response = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers,
    credentials: 'include',
    cache: 'no-store',
  })
  const data = (await response.json().catch(() => ({}))) as {error?: string}
  if (!response.ok) throw new Error(data.error || '请求失败')
  return data as T
}

/** 判断请求是否因后端不可达失败，用于前端退回本地演示数据 */
export function isOffline(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof Error && error.message === '请求失败')
}

export const api = {
  loginUrl: `${API_BASE}/api/auth/login`,
  session: () => request<{user: SessionUser | null}>('/auth/session'),
  logout: () => request<{ok: boolean}>('/auth/logout', {method: 'POST'}),
  seedList: () => request<SeedSummary[]>('/seeds'),
  createRoom: () => request<{code: string; playerId: string}>('/rooms', {method: 'POST'}),
  getRoom: (code: string) => request<Room>(`/rooms/${code}`),
  joinRoom: (code: string) => request<{code: string; playerId: string}>(`/rooms/${code}/join`, {method: 'POST'}),
  startRoom: (code: string, workId?: string) =>
    request<Room>(`/rooms/${code}/start`, {method: 'POST', body: JSON.stringify(workId ? {workId} : {})}),
  submitTurn: (code: string, body: {playerId: string; choiceId: string; text: string}) =>
    request<Room>(`/rooms/${code}/turn`, {method: 'POST', body: JSON.stringify(body)}),
  retry: (code: string) => request<Room>(`/rooms/${code}/retry`, {method: 'POST'}),
}
