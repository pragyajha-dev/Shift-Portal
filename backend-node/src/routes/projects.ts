import { Router } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { encrypt, decrypt } from '../services/encryption'
import { buildProjectsWorkbook } from '../services/excelExport'
import { validateSaveProjectRequest, type SaveProjectRequest } from '../services/projectValidation'
import { requireAdmin } from '../middleware/auth'
import type { AuthedRequest } from '../types'

export const projectsRouter = Router()

const PAGE_SIZE = 10

function nameFilter(search: unknown): Prisma.ProjectWhereInput {
  if (typeof search !== 'string' || !search.trim()) return {}
  return { name: { contains: search.trim(), mode: 'insensitive' } }
}

function sortOrder(sortDir: unknown): Prisma.ProjectOrderByWithRelationInput {
  return { name: sortDir === 'desc' ? 'desc' : 'asc' }
}

function toProjectDetail(project: Prisma.ProjectGetPayload<{ include: { environments: { include: { credentials: true } } } }>) {
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    environments: [...project.environments]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((env) => ({
        id: env.id,
        side: env.side,
        name: env.name,
        url: env.url,
        sortOrder: env.sortOrder,
        credentials: [...env.credentials]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((cred) => ({
            id: cred.id,
            roleLabel: cred.roleLabel,
            username: cred.username,
            password: decrypt(cred.passwordEncrypted),
            sortOrder: cred.sortOrder,
          })),
      })),
  }
}

projectsRouter.get('/', async (req, res) => {
  const page = Number(req.query.page)
  const currentPage = Number.isInteger(page) && page >= 1 ? page : 1

  const where = nameFilter(req.query.search)
  const orderBy = sortOrder(req.query.sortDir)

  const [totalCount, items] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy,
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])

  res.json({
    items: items.map((p) => ({ id: p.id, name: p.name, createdAt: p.createdAt, updatedAt: p.updatedAt })),
    totalCount,
    page: currentPage,
    pageSize: PAGE_SIZE,
  })
})

// Exports the full filtered list (not just the current page) with credential
// passwords unmasked. Open to any authenticated user — Viewers have "export data"
// as a granted permission per the PRD, this isn't Admin-only.
projectsRouter.get('/export', async (req, res) => {
  const where = nameFilter(req.query.search)
  const orderBy = sortOrder(req.query.sortDir)

  const projects = await prisma.project.findMany({
    where,
    orderBy,
    include: { environments: { include: { credentials: true } } },
  })

  const buffer = await buildProjectsWorkbook(projects)
  const fileName = `legacy2next-projects-${new Date().toISOString().slice(0, 10)}.xlsx`

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
  res.send(Buffer.from(buffer))
})

projectsRouter.get('/:id', async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: String(req.params.id) },
    include: { environments: { include: { credentials: true } } },
  })
  if (!project) return res.status(404).json({ message: 'Not found' })
  res.json(toProjectDetail(project))
})

projectsRouter.post('/', requireAdmin, async (req: AuthedRequest, res) => {
  const body = req.body as SaveProjectRequest
  const validationError = validateSaveProjectRequest(body)
  if (validationError) return res.status(400).json({ message: validationError })

  const project = await prisma.project.create({
    data: {
      name: body.name!.trim(),
      createdByUserId: req.auth!.sub,
      environments: {
        create: (body.environments ?? []).map((env, envIndex) => ({
          side: env.side as 'OutSystems' | 'NewApp',
          name: env.name!.trim(),
          url: env.url!.trim(),
          sortOrder: envIndex,
          credentials: {
            create: (env.credentials ?? []).map((cred, credIndex) => ({
              roleLabel: cred.roleLabel!.trim(),
              username: cred.username!.trim(),
              passwordEncrypted: encrypt(cred.password ?? ''),
              sortOrder: credIndex,
            })),
          },
        })),
      },
    },
    include: { environments: { include: { credentials: true } } },
  })

  res.status(201).json(toProjectDetail(project))
})

projectsRouter.put('/:id', requireAdmin, async (req: AuthedRequest, res) => {
  const id = String(req.params.id)
  const body = req.body as SaveProjectRequest
  const validationError = validateSaveProjectRequest(body)
  if (validationError) return res.status(400).json({ message: validationError })

  const existing = await prisma.project.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ message: 'Not found' })

  // Editing replaces the whole nested Environment/Credential graph in one action,
  // matching the PRD's "Save persists the project ... in a single action". Prisma's
  // nested `create` inside `update` runs in one transaction automatically, and
  // (unlike EF Core) doesn't need the delete flushed as a separate step first —
  // Prisma always knows explicitly which rows are new vs. existing.
  const project = await prisma.$transaction(async (tx) => {
    await tx.environment.deleteMany({ where: { projectId: id } })
    return tx.project.update({
      where: { id },
      data: {
        name: body.name!.trim(),
        updatedByUserId: req.auth!.sub,
        updatedAt: new Date(),
        environments: {
          create: (body.environments ?? []).map((env, envIndex) => ({
            side: env.side as 'OutSystems' | 'NewApp',
            name: env.name!.trim(),
            url: env.url!.trim(),
            sortOrder: envIndex,
            credentials: {
              create: (env.credentials ?? []).map((cred, credIndex) => ({
                roleLabel: cred.roleLabel!.trim(),
                username: cred.username!.trim(),
                passwordEncrypted: encrypt(cred.password ?? ''),
                sortOrder: credIndex,
              })),
            },
          })),
        },
      },
      include: { environments: { include: { credentials: true } } },
    })
  })

  res.json(toProjectDetail(project))
})

projectsRouter.delete('/:id', requireAdmin, async (req, res) => {
  const id = String(req.params.id)
  const existing = await prisma.project.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ message: 'Not found' })

  await prisma.project.delete({ where: { id } })
  res.status(204).send()
})
