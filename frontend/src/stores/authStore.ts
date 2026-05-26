import { create } from "zustand"
import { persist } from "zustand/middleware"

interface UserInfo {
  username: string
  role: string
  intern_name: string
  password_changed: boolean
}

interface AuthState {
  token: string | null
  user: UserInfo | null
  isAuthenticated: boolean
  hydrated: boolean
  login: (token: string, user: UserInfo) => void
  logout: () => void
  setPasswordChanged: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      hydrated: false,
      login: (token: string, user: UserInfo) =>
        set({ token, user, isAuthenticated: true }),
      logout: () =>
        set({ token: null, user: null, isAuthenticated: false }),
      setPasswordChanged: () =>
        set((s) => s.user ? { user: { ...s.user, password_changed: true } } : {}),
    }),
    {
      name: "auth-storage-v2",
      onRehydrateStorage: () => (_state) => {
        setTimeout(() => {
          useAuthStore.setState({ hydrated: true })
        }, 0)
      },
    }
  )
)
