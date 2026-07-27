import { NavLink, Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { RoleBadge } from '@/components/RoleBadge'
import { useAuth } from '@/lib/auth-context'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
    isActive
      ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/30'
      : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
  }`

export function AppLayout() {
  const { user, logout } = useAuth()

  if (!user) return null

  return (
    <div className="min-h-screen">
      <header className="glass-header sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="bg-gradient-to-br from-indigo-700 to-violet-600 bg-clip-text text-lg font-semibold text-transparent">
              Shift Portal
            </span>
            <nav className="flex items-center gap-1">
              <NavLink to="/" end className={navLinkClass}>
                Dashboard
              </NavLink>
              {user.role === 'Admin' && (
                <NavLink to="/users" className={navLinkClass}>
                  User Management
                </NavLink>
              )}
              <NavLink to="/profile" className={navLinkClass}>
                My Profile
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-sm text-slate-600">
              {user.fullName} <RoleBadge role={user.role} />
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
