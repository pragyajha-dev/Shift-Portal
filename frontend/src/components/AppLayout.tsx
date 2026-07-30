import { Outlet } from 'react-router-dom'
import { Archive, ArrowRight, Rocket } from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

// A static connector, not animated — motion here read as a loading spinner
// rather than a design element.
function LegacyToNextConnector() {
  return (
    <div className="relative mx-3 flex h-px flex-1 max-w-xs items-center bg-gradient-to-r from-slate-300 via-indigo-300 to-violet-400">
      <div className="absolute left-1/2 flex size-5 -translate-x-1/2 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-indigo-200/70">
        <ArrowRight className="size-3 text-indigo-500" />
      </div>
    </div>
  )
}

export function AppLayout() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-header sticky top-0 z-40 overflow-hidden px-6 py-6">
          <div className="float-blob pointer-events-none absolute -top-12 right-16 size-40 rounded-full bg-gradient-to-br from-indigo-400/30 to-violet-400/20 blur-2xl" />
          <div className="float-blob-delayed pointer-events-none absolute -bottom-16 left-1/4 size-32 rounded-full bg-gradient-to-br from-sky-400/25 to-pink-400/20 blur-2xl" />

          <p className="relative text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {getGreeting()},{' '}
            <span className="bg-gradient-to-br from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              {user.fullName}
            </span>
          </p>

          <div className="relative mt-4 flex max-w-xl items-center">
            <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-300/60 bg-slate-200/50 px-3 py-1.5">
              <Archive className="size-3.5 text-slate-500" />
              <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Legacy</span>
            </div>

            <LegacyToNextConnector />

            <div className="glow-pulse flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 px-3 py-1.5 shadow-md shadow-indigo-500/30">
              <Rocket className="size-3.5 text-white" />
              <span className="text-xs font-semibold tracking-wide text-white uppercase">Next</span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
