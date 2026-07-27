import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib/auth-context'
import { ApiError, projectsApi } from '@/lib/api'
import type { EnvironmentSide, ProjectDetail } from '@/lib/types'

const SIDES: EnvironmentSide[] = ['OutSystems', 'NewApp']
const SIDE_LABELS: Record<EnvironmentSide, string> = {
  OutSystems: 'OutSystems Details',
  NewApp: 'New App Details',
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
  const [activeTab, setActiveTab] = useState<EnvironmentSide>('OutSystems')

  useEffect(() => {
    if (!open || !token || !projectId) return
    setActiveTab('OutSystems')
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{project?.name ?? 'Project details'}</DialogTitle>
        </DialogHeader>

        {isLoading && <p className="py-8 text-center text-sm text-slate-400">Loading...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {project && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as EnvironmentSide)}>
            <TabsList>
              <TabsTrigger value="OutSystems">OutSystems Details</TabsTrigger>
              <TabsTrigger value="NewApp">New App Details</TabsTrigger>
            </TabsList>

            {SIDES.map((side) => {
              const envs = project.environments.filter((e) => e.side === side)
              return (
                <TabsContent key={side} value={side} className="mt-4 space-y-4">
                  {envs.length === 0 ? (
                    <p className="text-sm text-slate-400">No environments recorded for {SIDE_LABELS[side]}.</p>
                  ) : (
                    envs.map((env) => (
                      <div key={env.id} className="rounded-xl border border-indigo-100/70 bg-white/50 p-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-slate-500">Environment</p>
                            <p className="text-sm font-medium text-slate-900">{env.name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">URL</p>
                            <a
                              href={env.url}
                              target="_blank"
                              rel="noreferrer"
                              className="break-all text-sm font-medium text-blue-600 hover:underline"
                            >
                              {env.url}
                            </a>
                          </div>
                        </div>

                        {env.credentials.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {env.credentials.map((cred) => (
                              <div key={cred.id} className="grid grid-cols-3 gap-2 rounded-lg bg-slate-100/70 p-2">
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
                    ))
                  )}
                </TabsContent>
              )
            })}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
