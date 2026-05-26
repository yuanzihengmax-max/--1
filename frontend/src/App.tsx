import { Routes, Route, Navigate } from "react-router-dom"
import { useEffect, useState } from "react"
import { setLogoutHandler } from "@/lib/api"
import LoginPage from "@/pages/LoginPage"
import ChangePasswordPage from "@/pages/ChangePasswordPage"
import DashboardPage from "@/pages/DashboardPage"
import DailyReportPage from "@/pages/DailyReportPage"
import WeeklyReportPage from "@/pages/WeeklyReportPage"
import DataManagementPage from "@/pages/DataManagementPage"
import StatisticsPage from "@/pages/StatisticsPage"
import RecommendationLedgerPage from "@/pages/RecommendationLedgerPage"
import EliminationLedgerPage from "@/pages/EliminationLedgerPage"
import ProfilePage from "@/pages/ProfilePage"

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem("auth-storage-v2")
      if (raw) {
        const parsed = JSON.parse(raw)
        setToken(parsed.state?.token || null)
      }
    } catch {}
    setHydrated(true)
  }, [])

  useEffect(() => {
    setLogoutHandler(() => setToken(null))
  }, [])

  if (!hydrated) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2F6BFF]" /></div>
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<AuthGuard><ChangePasswordPage /></AuthGuard>} />
      <Route path="/dashboard" element={<AuthGuard><DashboardPage /></AuthGuard>} />
      <Route path="/daily-report" element={<AuthGuard><DailyReportPage /></AuthGuard>} />
      <Route path="/weekly-report" element={<AuthGuard><WeeklyReportPage /></AuthGuard>} />
      <Route path="/data-management" element={<AuthGuard><DataManagementPage /></AuthGuard>} />
      <Route path="/statistics" element={<AuthGuard><StatisticsPage /></AuthGuard>} />
      <Route path="/recommendation-ledger" element={<AuthGuard><RecommendationLedgerPage /></AuthGuard>} />
      <Route path="/elimination-ledger" element={<AuthGuard><EliminationLedgerPage /></AuthGuard>} />
      <Route path="/profile" element={<AuthGuard><ProfilePage /></AuthGuard>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
