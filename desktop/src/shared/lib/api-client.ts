export const API_BASE_URL = 'http://127.0.0.1:3000'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // FormData bodies must NOT get a JSON Content-Type — the browser sets its
  // own multipart boundary header, which a manual Content-Type would break.
  const isFormData = init?.body instanceof FormData
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: init?.body && !isFormData ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
    ...init
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new ApiError(body.error ?? `HTTP ${res.status}`, res.status)
  }

  return res.json() as Promise<T>
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  // Multipart form submission (file uploads) — no Content-Type header, the
  // browser sets the multipart boundary itself when the body is FormData.
  postForm: <T>(path: string, formData: FormData) => request<T>(path, { method: 'POST', body: formData })
}
