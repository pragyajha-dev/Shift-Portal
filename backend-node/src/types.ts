import type { Request } from 'express'
import type { User } from '@prisma/client'

export interface JwtClaims {
  sub: string
  email: string
  name: string
  role: 'Admin' | 'Viewer'
  mustChangePassword: boolean
}

export interface AuthedRequest extends Request {
  auth?: JwtClaims
}

export function toUserMeResponse(user: User) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
  }
}

export function toUserSummary(user: User) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    isActive: user.isActive,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  }
}
