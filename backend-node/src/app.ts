import express from 'express'
import cors from 'cors'
import { config } from './config'
import { seedInitialAdmin } from './seed'
import { authRouter } from './routes/auth'
import { usersRouter } from './routes/users'
import { projectsRouter } from './routes/projects'
import { authenticate, blockIfMustChangePassword, requireAdmin } from './middleware/auth'

let seeded = false

// Shared between local dev (src/index.ts calls app.listen) and the Vercel
// serverless entry point (api/index.ts calls this app directly as a handler).
export async function buildApp() {
  if (!seeded) {
    await seedInitialAdmin()
    seeded = true
  }

  const app = express()

  app.use(cors({ origin: config.frontendOrigin }))
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  // /login is public; /me and /change-password apply `authenticate` themselves.
  // They're also exactly the two paths allowed through the must-change-password
  // gate, so that gate only needs to be applied to routers added in later phases.
  app.use('/api/auth', authRouter)

  // Order matters: the must-change-password gate runs before the admin-role
  // check, matching the .NET version — an admin who still needs to change their
  // password gets that message, not a generic "forbidden".
  app.use('/api/users', authenticate, blockIfMustChangePassword, requireAdmin, usersRouter)

  // Projects: any authenticated user can read (list/detail/export); write
  // endpoints (create/update/delete) enforce requireAdmin individually inside
  // the router, since GET is open to Viewers too.
  app.use('/api/projects', authenticate, blockIfMustChangePassword, projectsRouter)

  return app
}
