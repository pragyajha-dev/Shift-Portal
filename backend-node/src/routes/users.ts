import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../prisma'
import { generateTemporaryPassword } from '../services/tempPassword'
import { toUserSummary, type AuthedRequest } from '../types'

export const usersRouter = Router()

const VALID_ROLES = new Set(['Admin', 'Viewer'])

usersRouter.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })
  res.json(users.map(toUserSummary))
})

usersRouter.post('/', async (req: AuthedRequest, res) => {
  const { fullName, email, role } = req.body as { fullName?: string; email?: string; role?: string }

  const trimmedName = fullName?.trim()
  const trimmedEmail = email?.trim().toLowerCase()

  if (!trimmedName || !trimmedEmail) {
    return res.status(400).json({ message: 'Full name and email are required.' })
  }
  if (!role || !VALID_ROLES.has(role)) {
    return res.status(400).json({ message: 'Role must be Admin or Viewer.' })
  }

  const existing = await prisma.user.findFirst({
    where: { email: { equals: trimmedEmail, mode: 'insensitive' } },
  })
  if (existing) {
    return res.status(409).json({ message: 'A user with this email already exists.' })
  }

  const temporaryPassword = generateTemporaryPassword()

  const user = await prisma.user.create({
    data: {
      fullName: trimmedName,
      email: trimmedEmail,
      passwordHash: await bcrypt.hash(temporaryPassword, 10),
      role: role as 'Admin' | 'Viewer',
      mustChangePassword: true,
      isActive: true,
      createdByUserId: req.auth!.sub,
    },
  })

  res.status(201).json({ user: toUserSummary(user), temporaryPassword })
})

usersRouter.put('/:id/role', async (req: AuthedRequest, res) => {
  const id = String(req.params.id)
  const { role } = req.body as { role?: string }

  if (id === req.auth!.sub) {
    return res.status(400).json({ message: 'You cannot change your own role. Ask another Admin.' })
  }
  if (!role || !VALID_ROLES.has(role)) {
    return res.status(400).json({ message: 'Role must be Admin or Viewer.' })
  }

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) {
    return res.status(404).json({ message: 'Not found' })
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: role as 'Admin' | 'Viewer' },
  })

  res.json(toUserSummary(updated))
})
