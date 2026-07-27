import type {
  ChangePasswordResponse,
  CreateUserResponse,
  LoginResponse,
  PagedResult,
  ProjectDetail,
  ProjectSummary,
  Role,
  SaveProjectPayload,
  UserMe,
  UserSummary,
} from './types'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5251'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface ApiFetchOptions {
  method?: string
  body?: unknown
  token?: string | null
}

async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    try {
      const data = await res.json()
      if (data?.message) message = data.message
    } catch {
      // response had no JSON body
    }
    throw new ApiError(message, res.status)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return (await res.json()) as T
}

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<LoginResponse>('/api/auth/login', { method: 'POST', body: { email, password } }),

  me: (token: string) => apiFetch<UserMe>('/api/auth/me', { token }),

  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    apiFetch<ChangePasswordResponse>('/api/auth/change-password', {
      method: 'POST',
      token,
      body: { currentPassword, newPassword },
    }),
}

export const usersApi = {
  list: (token: string) => apiFetch<UserSummary[]>('/api/users', { token }),

  create: (token: string, fullName: string, email: string, role: Role) =>
    apiFetch<CreateUserResponse>('/api/users', {
      method: 'POST',
      token,
      body: { fullName, email, role },
    }),

  updateRole: (token: string, id: string, role: Role) =>
    apiFetch<UserSummary>(`/api/users/${id}/role`, {
      method: 'PUT',
      token,
      body: { role },
    }),
}

export interface ListProjectsParams {
  search?: string
  page?: number
  sortDir?: 'asc' | 'desc'
}

export const projectsApi = {
  list: (token: string, params: ListProjectsParams = {}) => {
    const query = new URLSearchParams()
    if (params.search) query.set('search', params.search)
    if (params.page) query.set('page', String(params.page))
    if (params.sortDir) query.set('sortDir', params.sortDir)
    const qs = query.toString()
    return apiFetch<PagedResult<ProjectSummary>>(`/api/projects${qs ? `?${qs}` : ''}`, { token })
  },

  get: (token: string, id: string) => apiFetch<ProjectDetail>(`/api/projects/${id}`, { token }),

  create: (token: string, payload: SaveProjectPayload) =>
    apiFetch<ProjectDetail>('/api/projects', { method: 'POST', token, body: payload }),

  update: (token: string, id: string, payload: SaveProjectPayload) =>
    apiFetch<ProjectDetail>(`/api/projects/${id}`, { method: 'PUT', token, body: payload }),

  remove: (token: string, id: string) =>
    apiFetch<void>(`/api/projects/${id}`, { method: 'DELETE', token }),

  exportToExcel: async (token: string, params: Pick<ListProjectsParams, 'search' | 'sortDir'> = {}) => {
    const query = new URLSearchParams()
    if (params.search) query.set('search', params.search)
    if (params.sortDir) query.set('sortDir', params.sortDir)
    const qs = query.toString()

    const res = await fetch(`${API_BASE_URL}/api/projects/export${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new ApiError(`Export failed with status ${res.status}`, res.status)
    }
    return res.blob()
  },
}
