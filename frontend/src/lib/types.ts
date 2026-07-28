export type Role = 'Admin' | 'Viewer'

export interface UserMe {
  id: string
  fullName: string
  email: string
  role: Role
  mustChangePassword: boolean
  lastLoginAt: string | null
}

export interface UserSummary {
  id: string
  fullName: string
  email: string
  role: Role
  mustChangePassword: boolean
  isActive: boolean
  createdAt: string
  lastLoginAt: string | null
}

export interface LoginResponse {
  token: string
  user: UserMe
}

export interface ChangePasswordResponse {
  token: string
  user: UserMe
}

export interface CreateUserResponse {
  user: UserSummary
  temporaryPassword: string
}

export interface ProjectSummary {
  id: string
  name: string
  createdAt: string
  updatedAt: string | null
}

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
}

export type EnvironmentSide = 'OutSystems' | 'NewApp'

export const SIDE_LABELS: Record<EnvironmentSide, string> = {
  OutSystems: 'OutSystems Details',
  NewApp: 'Pro Code Details',
}

export interface CredentialDetail {
  id: string
  roleLabel: string
  username: string
  password: string
  sortOrder: number
}

export interface EnvironmentDetail {
  id: string
  side: EnvironmentSide
  name: string
  url: string
  sortOrder: number
  credentials: CredentialDetail[]
}

export interface ProjectDetail {
  id: string
  name: string
  createdAt: string
  updatedAt: string | null
  environments: EnvironmentDetail[]
}

export interface SaveCredentialPayload {
  roleLabel: string
  username: string
  password: string
  sortOrder: number
}

export interface SaveEnvironmentPayload {
  side: EnvironmentSide
  name: string
  url: string
  sortOrder: number
  credentials: SaveCredentialPayload[]
}

export interface SaveProjectPayload {
  name: string
  environments: SaveEnvironmentPayload[]
}
