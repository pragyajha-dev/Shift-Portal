import type { NextFunction, Response } from 'express'
import { verifyToken } from '../services/token'
import type { AuthedRequest } from '../types'

export function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    req.auth = verifyToken(token)
    next()
  } catch {
    return res.status(401).json({ message: 'Unauthorized' })
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.auth?.role !== 'Admin') {
    return res.status(403).json({ message: 'Forbidden' })
  }
  next()
}

// Blocks every route except the ones needed to check your own profile and change
// your password, while the account still has MustChangePassword set. Mirrors the
// same server-side gate from the .NET backend — not just a frontend redirect.
const ALLOWED_WHILE_MUST_CHANGE_PASSWORD = new Set(['/api/auth/me', '/api/auth/change-password'])

export function blockIfMustChangePassword(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.auth?.mustChangePassword && !ALLOWED_WHILE_MUST_CHANGE_PASSWORD.has(req.path)) {
    return res.status(403).json({ message: 'Password change required before continuing.' })
  }
  next()
}
