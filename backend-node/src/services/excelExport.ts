import ExcelJS from 'exceljs'
import type { Prisma } from '@prisma/client'
import { decrypt } from './encryption'

type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: { environments: { include: { credentials: true } } }
}>
type EnvironmentWithCredentials = ProjectWithRelations['environments'][number]

const HEADERS = [
  'Project Name', 'Persona', 'Environment',
  'OutSystems URL', 'OutSystems Username', 'OutSystems Password',
  'Pro Code URL', 'Pro Code Username', 'Pro Code Password',
]

function buildNameMap(envs: EnvironmentWithCredentials[]): Map<string, EnvironmentWithCredentials> {
  const map = new Map<string, EnvironmentWithCredentials>()
  for (const e of envs) map.set(e.name.toLowerCase(), e) // last wins on duplicate name, same as the .NET version
  return map
}

function unionEnvNames(outEnvs: EnvironmentWithCredentials[], proEnvs: EnvironmentWithCredentials[]): string[] {
  const seen = new Map<string, string>() // lowercase key -> first-seen display casing
  for (const e of [...outEnvs, ...proEnvs]) {
    const key = e.name.toLowerCase()
    if (!seen.has(key)) seen.set(key, e.name)
  }
  return [...seen.values()]
}

function unionPersonas(environments: EnvironmentWithCredentials[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const e of environments) {
    for (const c of e.credentials) {
      if (!seen.has(c.roleLabel)) {
        seen.add(c.roleLabel)
        result.push(c.roleLabel)
      }
    }
  }
  return result
}

// Side-by-side column groups (OutSystems vs. Pro Code) instead of an interleaved
// "Side" column — personas are shared across both sides (see the Add/Edit form),
// so one row per persona × environment name reads far cleaner than one row per
// raw credential with a side label repeated down a single column.
export async function buildProjectsWorkbook(projects: ProjectWithRelations[]) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Projects')

  const headerRow = sheet.addRow(HEADERS)
  headerRow.font = { bold: true }
  const outFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
  const proFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }
  ;[4, 5, 6].forEach((i) => (headerRow.getCell(i).fill = outFill))
  ;[7, 8, 9].forEach((i) => (headerRow.getCell(i).fill = proFill))

  const sortedProjects = [...projects].sort((a, b) => a.name.localeCompare(b.name))

  for (const project of sortedProjects) {
    const outEnvs = project.environments
      .filter((e) => e.side === 'OutSystems')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const proEnvs = project.environments
      .filter((e) => e.side === 'NewApp')
      .sort((a, b) => a.sortOrder - b.sortOrder)

    if (outEnvs.length === 0 && proEnvs.length === 0) {
      sheet.addRow([project.name])
      continue
    }

    const outByName = buildNameMap(outEnvs)
    const proByName = buildNameMap(proEnvs)
    const envNames = unionEnvNames(outEnvs, proEnvs)
    const personas = unionPersonas(project.environments)

    // No credentials recorded anywhere yet: still list each environment's URL.
    if (personas.length === 0) {
      for (const envName of envNames) {
        const oEnv = outByName.get(envName.toLowerCase())
        const pEnv = proByName.get(envName.toLowerCase())
        sheet.addRow([project.name, '', envName, oEnv?.url ?? '', '', '', pEnv?.url ?? '', '', ''])
      }
      continue
    }

    for (const persona of personas) {
      for (const envName of envNames) {
        const oEnv = outByName.get(envName.toLowerCase())
        const pEnv = proByName.get(envName.toLowerCase())
        const oCred = oEnv?.credentials.find((c) => c.roleLabel === persona)
        const pCred = pEnv?.credentials.find((c) => c.roleLabel === persona)

        sheet.addRow([
          project.name,
          persona,
          envName,
          oEnv?.url ?? '',
          oCred?.username ?? '',
          oCred ? decrypt(oCred.passwordEncrypted) : '',
          pEnv?.url ?? '',
          pCred?.username ?? '',
          pCred ? decrypt(pCred.passwordEncrypted) : '',
        ])
      }
    }
  }

  sheet.columns.forEach((col) => {
    col.width = 22
  })

  return workbook.xlsx.writeBuffer()
}
