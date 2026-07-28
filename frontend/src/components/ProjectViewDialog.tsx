import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Archive, Eye, EyeOff, Rocket, UserRound } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth-context'
import { ApiError, projectsApi } from '@/lib/api'
import type { CredentialDetail, ProjectDetail } from '@/lib/types'

interface PersonaEntry {
  environmentId: string
  environmentName: string
  url: string
  credential: CredentialDetail
}

interface PersonaGroup {
  name: string
  outSystems: PersonaEntry[]
  proCode: PersonaEntry[]
}

function groupByPersona(project: ProjectDetail): PersonaGroup[] {
  const order: string[] = []
  const groups = new Map<string, PersonaGroup>()

  for (const env of project.environments) {
    for (const cred of env.credentials) {
      if (!groups.has(cred.roleLabel)) {
        groups.set(cred.roleLabel, { name: cred.roleLabel, outSystems: [], proCode: [] })
        order.push(cred.roleLabel)
      }
      const group = groups.get(cred.roleLabel)!
      const entry: PersonaEntry = { environmentId: env.id, environmentName: env.name, url: env.url, credential: cred }
      if (env.side === 'OutSystems') group.outSystems.push(entry)
      else group.proCode.push(entry)
    }
  }

  return order.map((name) => groups.get(name)!)
}

interface ProjectViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string | null
}

export function ProjectViewDialog({ open, onOpenChange, projectId }: ProjectViewDialogProps) {
  const { token } = useAuth()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open || !token || !projectId) return
    setRevealed(new Set())
    setError(null)
    setIsLoading(true)
    projectsApi
      .get(token, projectId)
      .then(setProject)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load project.'))
      .finally(() => setIsLoading(false))
  }, [open, token, projectId])

  const personaGroups = useMemo(() => (project ? groupByPersona(project) : []), [project])

  function toggleReveal(credentialId: string) {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(credentialId)) next.delete(credentialId)
      else next.add(credentialId)
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto p-6 sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{project?.name ?? 'Project details'}</DialogTitle>
        </DialogHeader>

        {isLoading && <p className="py-8 text-center text-sm text-slate-400">Loading...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {project && personaGroups.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400">
            No personas or credentials recorded for this project yet.
          </p>
        )}

        {project && personaGroups.length > 0 && (
          <div className="space-y-4">
            {personaGroups.map((group) => (
              <div key={group.name} className="rounded-2xl border border-slate-200/70 bg-white/60 p-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/15 to-violet-500/15 text-indigo-600">
                    <UserRound className="size-4" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{group.name}</h3>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <PersonaSideColumn
                    label="OutSystems"
                    icon={<Archive className="size-3.5" />}
                    accentClass="border-slate-200 bg-slate-50/70"
                    labelClass="text-slate-500"
                    entries={group.outSystems}
                    revealed={revealed}
                    onToggleReveal={toggleReveal}
                  />
                  <PersonaSideColumn
                    label="Pro Code"
                    icon={<Rocket className="size-3.5" />}
                    accentClass="border-indigo-200/60 bg-indigo-50/40"
                    labelClass="text-indigo-500"
                    entries={group.proCode}
                    revealed={revealed}
                    onToggleReveal={toggleReveal}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PersonaSideColumn({
  label,
  icon,
  accentClass,
  labelClass,
  entries,
  revealed,
  onToggleReveal,
}: {
  label: string
  icon: ReactNode
  accentClass: string
  labelClass: string
  entries: PersonaEntry[]
  revealed: Set<string>
  onToggleReveal: (id: string) => void
}) {
  return (
    <div className={`rounded-xl border p-3 ${accentClass}`}>
      <div className={`mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase ${labelClass}`}>
        {icon} {label}
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-slate-400">Not configured</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.credential.id} className="rounded-lg bg-white/80 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-800">{entry.environmentName}</span>
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noreferrer"
                  className="max-w-[45%] truncate text-xs font-medium text-blue-600 hover:underline"
                  title={entry.url}
                >
                  {entry.url}
                </a>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-600">
                <span className="truncate">{entry.credential.username}</span>
                <span className="flex items-center gap-1 font-mono text-slate-900">
                  {revealed.has(entry.credential.id) ? entry.credential.password : '••••••••'}
                  <button
                    type="button"
                    className="text-slate-400 hover:text-slate-600"
                    onClick={() => onToggleReveal(entry.credential.id)}
                  >
                    {revealed.has(entry.credential.id) ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

