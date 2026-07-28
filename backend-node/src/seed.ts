import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

const INITIAL_ADMIN_EMAIL = 'admin@legacy2next.local'
const INITIAL_ADMIN_TEMP_PASSWORD = 'ChangeMe123!'

export async function seedInitialAdmin() {
  const userCount = await prisma.user.count()
  if (userCount > 0) return

  await prisma.user.create({
    data: {
      fullName: 'Admin',
      email: INITIAL_ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(INITIAL_ADMIN_TEMP_PASSWORD, 10),
      role: 'Admin',
      mustChangePassword: true,
      isActive: true,
    },
  })

  console.warn(
    `Seeded initial admin account. Email: ${INITIAL_ADMIN_EMAIL} | Temp password: ${INITIAL_ADMIN_TEMP_PASSWORD} (must be changed on first login)`,
  )
}
