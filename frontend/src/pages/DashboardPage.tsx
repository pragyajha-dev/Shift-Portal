import { useCallback, useEffect, useState } from 'react'
import { Eye, Pencil, Trash2, ArrowUpDown } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ProjectFormDialog } from '@/components/ProjectFormDialog'
import { ProjectViewDialog } from '@/components/ProjectViewDialog'
import { useAuth } from '@/lib/auth-context'
import { ApiError, projectsApi } from '@/lib/api'
import type { ProjectSummary } from '@/lib/types'

const PAGE_SIZE = 10

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

export function DashboardPage() {
  const { token, user } = useAuth()
  const isAdmin = user?.role === 'Admin'

  const [items, setItems] = useState<ProjectSummary[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [projectPendingDelete, setProjectPendingDelete] = useState<ProjectSummary | null>(null)

  const [viewProjectId, setViewProjectId] = useState<string | null>(null)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [editProjectId, setEditProjectId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const loadProjects = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await projectsApi.list(token, { search, page, sortDir })
      setItems(result.items)
      setTotalCount(result.totalCount)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load projects.')
    } finally {
      setIsLoading(false)
    }
  }, [token, search, page, sortDir])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Debounce search input before it drives the actual query.
  useEffect(() => {
    const handle = setTimeout(() => {
      setPage(1)
      setSearch(searchInput)
    }, 300)
    return () => clearTimeout(handle)
  }, [searchInput])

  async function confirmDelete() {
    if (!token || !projectPendingDelete) return

    setDeletingId(projectPendingDelete.id)
    try {
      await projectsApi.remove(token, projectPendingDelete.id)
      setProjectPendingDelete(null)
      await loadProjects()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to delete project.')
    } finally {
      setDeletingId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  function openView(project: ProjectSummary) {
    setViewProjectId(project.id)
    setIsViewOpen(true)
  }

  function openAdd() {
    setEditProjectId(null)
    setIsFormOpen(true)
  }

  function openEdit(project: ProjectSummary) {
    setEditProjectId(project.id)
    setIsFormOpen(true)
  }

  async function handleExport() {
    if (!token) return
    setIsExporting(true)
    try {
      const blob = await projectsApi.exportToExcel(token, { search, sortDir })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `shift-portal-projects-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to export projects.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-slate-900">Projects</h1>
        {isAdmin && <Button onClick={openAdd}>+ Add Project</Button>}
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <Input
          placeholder="Search by project name..."
          className="max-w-xs bg-white/50"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Button variant="outline" disabled={isExporting} onClick={handleExport}>
          {isExporting ? 'Exporting...' : 'Export to Excel'}
        </Button>
      </div>

      <div className="glass-panel mt-4 overflow-hidden rounded-2xl">
        {error && <p className="p-4 text-sm text-red-600">{error}</p>}

        {isLoading ? (
          <p className="p-4 text-sm text-slate-400">Loading...</p>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">No projects found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    className="flex items-center gap-1 font-medium hover:text-slate-900"
                    onClick={() => {
                      setPage(1)
                      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                    }}
                  >
                    Project Name
                    <ArrowUpDown className="size-3.5" />
                  </button>
                </TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell className="text-slate-500">{formatDate(project.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" title="View project" onClick={() => openView(project)}>
                        <Eye className="size-4" />
                      </Button>
                      {isAdmin && (
                        <>
                          <Button variant="ghost" size="icon-sm" title="Edit project" onClick={() => openEdit(project)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Delete project"
                            disabled={deletingId === project.id}
                            onClick={() => setProjectPendingDelete(project)}
                          >
                            <Trash2 className="size-4 text-red-600" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {totalCount > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {page} of {totalPages} ({totalCount} project{totalCount === 1 ? '' : 's'})
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <ProjectViewDialog open={isViewOpen} onOpenChange={setIsViewOpen} projectId={viewProjectId} />
      <ProjectFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        projectId={editProjectId}
        onSaved={loadProjects}
      />

      <AlertDialog
        open={projectPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setProjectPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{projectPendingDelete?.name}"? This also removes all of its
              environments and credentials. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-gradient-to-br from-red-600 to-rose-600 text-white shadow-md shadow-red-500/25 hover:from-red-500 hover:to-rose-500"
              disabled={deletingId === projectPendingDelete?.id}
              onClick={confirmDelete}
            >
              {deletingId === projectPendingDelete?.id ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
