import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'

export function ProtectedRoute({ requireAdmin = false }: { requireAdmin?: boolean }) {
  const { token, user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Loading...</div>
  }

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  if (requireAdmin && user.role !== 'Admin') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
