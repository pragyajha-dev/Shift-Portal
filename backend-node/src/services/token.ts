import jwt from 'jsonwebtoken'
import type { User } from '@prisma/client'
import { config } from '../config'
import type { JwtClaims } from '../types'

export function generateToken(user: User): string {
  const claims: JwtClaims = {
    sub: user.id,
    email: user.email,
    name: user.fullName,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  }

  return jwt.sign(claims, config.jwt.secret, {
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    expiresIn: `${config.jwt.expiryMinutes}m`,
  })
}

export function verifyToken(token: string): JwtClaims {
  return jwt.verify(token, config.jwt.secret, {
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  }) as JwtClaims
}
