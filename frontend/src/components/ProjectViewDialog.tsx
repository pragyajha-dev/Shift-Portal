import { useEffect, useState } from 'react'
import { Archive, Eye, EyeOff, Rocket } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth-context'
import { ApiError, projectsApi } from '@/lib/api'
import { SIDE_LABELS, type EnvironmentSide, type ProjectDetail } from '@/lib/types'

const SIDES: EnvironmentSide[] = ['OutSystems', 'NewApp']
const SIDE_ICON: Record<EnvironmentSide, typeof Archive> = { OutSystems: Archive, NewApp: Rocket }
const SIDE_ACCENT: Record<EnvironmentSide, { label: string; card: string }> = {
  OutSystems: { label: 'text-slate-500', card: 'border-slate-200 bg-slate-50/70' },
  NewApp: { label: 'text-indigo-500', card: 'border-indigo-200/60 bg-indigo-50/40' },
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

        {project && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {SIDES.map((side) => {
              const envs = project.environments.filter((e) => e.side === side)
              const Icon = SIDE_ICON[side]
              const accent = SIDE_ACCENT[side]
              return (
                <div key={side} className="min-w-0">
                  <div className={`mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase ${accent.label}`}>
                    <Icon className="size-3.5" />
                    {SIDE_LABELS[side]}
                  </div>

                  {envs.length === 0 ? (
                    <p className="text-sm text-slate-400">No environments recorded for {SIDE_LABELS[side]}.</p>
                  ) : (
                    <div className="space-y-3">
                      {envs.map((env) => (
                        <div key={env.id} className={`rounded-xl border p-3 ${accent.card}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-xs text-slate-500">Environment</p>
                              <p className="text-sm font-medium text-slate-900">{env.name}</p>
                            </div>
                            <a
                              href={env.url}
                              target="_blank"
                              rel="noreferrer"
                              className="max-w-[55%] truncate text-xs font-medium text-blue-600 hover:underline"
                              title={env.url}
                            >
                              {env.url}
                            </a>
                          </div>

                          {env.credentials.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              {env.credentials.map((cred) => (
                                <div key={cred.id} className="grid grid-cols-3 gap-2 rounded-lg bg-white/80 p-2">
                                  <div>
                                    <p className="text-xs text-slate-500">Role</p>
                                    <p className="text-sm font-medium text-slate-900">{cred.roleLabel}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-500">Username</p>
                                    <p className="text-sm font-medium text-slate-900">{cred.username}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-500">Password</p>
                                    <div className="flex items-center gap-1.5">
                                      <p className="font-mono text-sm font-medium text-slate-900">
                                        {revealed.has(cred.id) ? cred.password : '••••••••'}
                                      </p>
                                      <button
                                        type="button"
                                        className="text-slate-400 hover:text-slate-600"
                                        onClick={() => toggleReveal(cred.id)}
                                      >
                                        {revealed.has(cred.id) ? (
                                          <EyeOff className="size-3.5" />
                                        ) : (
                                          <Eye className="size-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
