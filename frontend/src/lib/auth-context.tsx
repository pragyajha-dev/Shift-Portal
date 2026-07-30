import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { authApi } from './api'
import type { UserMe } from './types'

const TOKEN_STORAGE_KEY = 'legacy2next.token'
export const SESSION_EXPIRED_FLAG = 'legacy2next.sessionExpired'

interface AuthContextValue {
  token: string | null
  user: UserMe | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  completePasswordChange: (token: string, user: UserMe) => void
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY))
  const [user, setUser] = useState<UserMe | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadUser() {
      if (!token) {
        setIsLoading(false)
        return
      }
      try {
        const me = await authApi.me(token)
        if (!cancelled) setUser(me)
      } catch {
        if (!cancelled) {
          setToken(null)
          localStorage.removeItem(TOKEN_STORAGE_KEY)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadUser()
    return () => {
      cancelled = true
    }
  }, [token])

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password)
    localStorage.setItem(TOKEN_STORAGE_KEY, response.token)
    setToken(response.token)
    setUser(response.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
    setUser(null)
  }, [])

  // Any API call that comes back 401 (expired/invalid token) dispatches this —
  // without it, the app just left users stuck on a broken page showing a raw
  // "Unauthorized" error instead of sending them back to log in.
  useEffect(() => {
    function handleUnauthorized() {
      sessionStorage.setItem(SESSION_EXPIRED_FLAG, '1')
      logout()
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [logout])

  const completePasswordChange = useCallback((newToken: string, newUser: UserMe) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken)
    setToken(newToken)
    setUser(newUser)
  }, [])

  const refreshMe = useCallback(async () => {
    if (!token) return
    const me = await authApi.me(token)
    setUser(me)
  }, [token])

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout, completePasswordChange, refreshMe }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
