import { useLocation, useNavigate } from "react-router-dom"
import {
  ClipboardList, LayoutDashboard, BookOpen, XCircle, BarChart3,
  PieChart, Database, UserCircle, LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import pkg from "../../package.json"

const NAV_ITEMS = [
  { path: "/dashboard", label: "首页", icon: LayoutDashboard },
  { path: "/recommendation-ledger", label: "推荐台账", icon: BookOpen },
  { path: "/elimination-ledger", label: "淘汰台账", icon: XCircle },
  { path: "/daily-report", label: "日报", icon: BarChart3 },
  { path: "/weekly-report", label: "周报", icon: PieChart },
  { path: "/data-management", label: "数据管理", icon: Database },
  { path: "/profile", label: "个人中心", icon: UserCircle },
]

function getUser() {
  try {
    const raw = localStorage.getItem("auth-storage-v2")
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed.state?.user ?? null
  } catch {
    return null
  }
}

export default function AppNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = getUser()

  const handleLogout = () => {
    try {
      localStorage.removeItem("auth-storage-v2")
    } catch {
      // ignore
    }
    navigate("/login", { replace: true })
  }

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-[#E6EAF2] h-14">
      <div className="max-w-[1600px] mx-auto px-4 xl:px-6 h-full flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#DEE8FF] flex items-center justify-center">
            <ClipboardList className="h-4 w-4 text-[#2F6BFF]" />
          </div>
          <span className="font-bold text-[#152033] text-base">招聘台账</span>
          <span className="text-[10px] leading-tight text-[#637089] bg-[#EDF0F7] rounded px-1.5 py-0.5 font-medium">
            v{pkg.version}
          </span>
        </div>

        {/* Nav links */}
        <div className="hidden lg:flex items-center gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-[#2F6BFF] text-white shadow-sm"
                    : "text-[#637089] hover:bg-[#EDF0F7] hover:text-[#152033]",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            )
          })}
        </div>

        {/* Mobile nav links - scrollable */}
        <div className="flex lg:hidden items-center gap-0.5 overflow-x-auto flex-1 mx-2 no-scrollbar">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0",
                  isActive
                    ? "bg-[#2F6BFF] text-white shadow-sm"
                    : "text-[#637089] hover:bg-[#EDF0F7]",
                )}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                {item.label}
              </button>
            )
          })}
        </div>

        {/* User info */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-[#152033] font-medium hidden sm:inline">
            {user?.display_name || user?.username || "用户"}
          </span>
          <span
            className={cn(
              "text-xs rounded px-1.5 py-0.5 font-medium",
              user?.role === "admin"
                ? "bg-[#DEE8FF] text-[#2F6BFF]"
                : "bg-[#E8F5E9] text-[#16A37B]",
            )}
          >
            {user?.role === "admin" ? "管理员" : "实习生"}
          </span>
          <button
            onClick={handleLogout}
            className="text-[#637089] hover:text-[#E5484D] transition-colors p-1.5 rounded-md hover:bg-red-50"
            title="退出登录"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  )
}
