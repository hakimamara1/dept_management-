import * as Crypto from 'expo-crypto'
import { useConnectionStore } from '@/modules/connection/store'

export type ApiErrorCode = 'NETWORK' | 'TIMEOUT' | 'HTTP' | 'NOT_PAIRED'

export class ApiError extends Error {
  code: ApiErrorCode
  status: number
  /** The underlying failure (e.g. the fetch error text) — for diagnostics, never shown as the user message. */
  detail?: string
  constructor(message: string, code: ApiErrorCode, status = 0, detail?: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.detail = detail
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  form?: FormData
  /** Default 20 s; the photo → AI extraction call needs far longer. */
  timeoutMs?: number
  /** Required on every money action — a retried request replays the first response instead of re-executing. */
  idempotencyKey?: string
}

/** A fresh random key per user action (not per retry) — 32 URL-safe hex chars from the platform CSPRNG. */
export function newIdempotencyKey(): string {
  return Crypto.randomUUID().replace(/-/g, '')
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { connection } = useConnectionStore.getState()
  if (!connection) throw new ApiError('Not paired', 'NOT_PAIRED')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000)
  const headers: Record<string, string> = { Authorization: `Bearer ${connection.token}` }
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`http://${connection.lastHost}:${connection.port}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
      signal: controller.signal
    })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    if (__DEV__) console.warn(`[api] ${options.method ?? 'GET'} ${path} failed — ${detail}`)
    throw new ApiError(aborted ? 'Request timed out' : 'Desktop not reachable', aborted ? 'TIMEOUT' : 'NETWORK', 0, detail)
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 401) {
    // The desktop no longer accepts this token — a definitive state, not a hiccup.
    useConnectionStore.getState().setStatus('unauthorized')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError((data && data.error) || `HTTP ${res.status}`, 'HTTP', res.status)
  }
  return data as T
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => apiRequest<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) => apiRequest<T>(path, { ...options, method: 'DELETE' })
}
