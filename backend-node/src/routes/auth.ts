import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../prisma'
import { generateToken } from '../services/token'
import { authenticate } from '../middleware/auth'
import { toUserMeResponse, type AuthedRequest } from '../types'

export const authRouter = Router()

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string }
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' })
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: 'insensitive' } },
  })

  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  const token = generateToken(updated)
  res.json({ token, user: toUserMeResponse(updated) })
})

authRouter.get('/me', authenticate, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } })
  if (!user) return res.status(401).json({ message: 'Unauthorized' })
  res.json(toUserMeResponse(user))
})

authRouter.post('/change-password', authenticate, async (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string }

  const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } })
  if (!user) return res.status(401).json({ message: 'Unauthorized' })

  if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return res.status(400).json({ message: 'Current password is incorrect.' })
  }

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters.' })
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, 10),
      mustChangePassword: false,
    },
  })

  const token = generateToken(updated)
  res.json({ token, user: toUserMeResponse(updated) })
})
