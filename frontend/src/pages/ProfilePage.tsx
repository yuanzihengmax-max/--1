import { useState, useEffect, useCallback } from "react"
import AppNav from "@/components/AppNav"
import {
  changePwd,
  getUsers,
  createUserApi,
  resetUserPwd,
  toggleUserActive,
} from "@/lib/api"
import { cn } from "@/lib/utils"
import type { UserInfo } from "@/types"
import {
  User,
  Shield,
  ShieldCheck,
  Key,
  Lock,
  Unlock,
  Plus,
  RefreshCw,
  CheckCheck,
  AlertCircle,
  Eye,
  EyeOff,
  UserPlus,
  Loader2,
} from "lucide-react"

// ─── Helpers ─────────────────────────────────────────────────────────
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

// ─── Toast Component (inline) ────────────────────────────────────────
function Toast({
  type,
  message,
  onClose,
}: {
  type: "success" | "error"
  message: string
  onClose: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={cn(
        "fixed top-20 right-6 z-[60] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2",
        type === "success" ? "bg-[#16A37B] text-white" : "bg-[#E5484D] text-white",
      )}
    >
      {type === "success" ? (
        <CheckCheck className="h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0" />
      )}
      {message}
    </div>
  )
}

// ─── Change Password Dialog ──────────────────────────────────────────
function ChangePasswordDialog({
  open,
  onClose,
  onSuccess,
  onError,
}: {
  open: boolean
  onClose: () => void
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [oldPwd, setOldPwd] = useState("")
  const [newPwd, setNewPwd] = useState("")
  const [confirmPwd, setConfirmPwd] = useState("")
  const [loading, setLoading] = useState(false)
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [fieldError, setFieldError] = useState("")

  const reset = () => {
    setOldPwd("")
    setNewPwd("")
    setConfirmPwd("")
    setFieldError("")
    setShowOld(false)
    setShowNew(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldError("")

    if (!oldPwd || !newPwd || !confirmPwd) {
      setFieldError("请填写所有密码字段")
      return
    }
    if (newPwd.length < 6) {
      setFieldError("新密码长度不能少于6位")
      return
    }
    if (newPwd !== confirmPwd) {
      setFieldError("两次输入的新密码不一致")
      return
    }
    if (oldPwd === newPwd) {
      setFieldError("新密码不能与旧密码相同")
      return
    }

    setLoading(true)
    try {
      await changePwd(oldPwd, newPwd)
      const raw = localStorage.getItem("auth-storage-v2")
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.state?.user) {
          parsed.state.user.password_changed = true
        }
        localStorage.setItem("auth-storage-v2", JSON.stringify(parsed))
      }
      reset()
      onSuccess("密码修改成功")
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "修改密码失败"
      setFieldError(msg)
      onError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl border border-[#E6EAF2] p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-[#DEE8FF] flex items-center justify-center">
            <Key className="h-5 w-5 text-[#2F6BFF]" />
          </div>
          <div>
            <h3 className="font-semibold text-[#152033]">修改密码</h3>
            <p className="text-xs text-[#637089]">请填写以下信息修改登录密码</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {fieldError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-[#E5484D]">
              {fieldError}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-[#152033]">旧密码</label>
            <div className="relative mt-1">
              <input
                type={showOld ? "text" : "password"}
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value)}
                className="w-full px-3 py-2 pr-9 rounded-md border border-[#C8CDD8] text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]"
                placeholder="请输入旧密码"
              />
              <button
                type="button"
                onClick={() => setShowOld(!showOld)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#637089] hover:text-[#152033]"
              >
                {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-[#152033]">新密码</label>
            <div className="relative mt-1">
              <input
                type={showNew ? "text" : "password"}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="w-full px-3 py-2 pr-9 rounded-md border border-[#C8CDD8] text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]"
                placeholder="新密码（至少6位）"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#637089] hover:text-[#152033]"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-[#152033]">确认新密码</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-[#C8CDD8] text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]"
              placeholder="再次输入新密码"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                reset()
                onClose()
              }}
              className="px-4 py-2 text-sm font-medium text-[#637089] hover:text-[#152033] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#2F6BFF] text-white rounded-md text-sm font-medium hover:bg-[#1a5ae0] disabled:opacity-60 transition-colors inline-flex items-center gap-1.5"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "提交中..." : "确认修改"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Add User Dialog ─────────────────────────────────────────────────
function AddUserDialog({
  open,
  onClose,
  onSuccess,
  onError,
}: {
  open: boolean
  onClose: () => void
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("intern")
  const [loading, setLoading] = useState(false)
  const [fieldError, setFieldError] = useState("")

  const reset = () => {
    setUsername("")
    setDisplayName("")
    setPassword("")
    setRole("intern")
    setFieldError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldError("")

    if (!username.trim()) {
      setFieldError("请输入用户名")
      return
    }
    if (!displayName.trim()) {
      setFieldError("请输入显示名称")
      return
    }
    if (!password || password.length < 6) {
      setFieldError("密码长度不能少于6位")
      return
    }

    setLoading(true)
    try {
      await createUserApi({
        username: username.trim(),
        display_name: displayName.trim(),
        password,
        role,
      })
      reset()
      onSuccess("用户添加成功")
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "添加用户失败"
      setFieldError(msg)
      onError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl border border-[#E6EAF2] p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-[#DEE8FF] flex items-center justify-center">
            <UserPlus className="h-5 w-5 text-[#2F6BFF]" />
          </div>
          <div>
            <h3 className="font-semibold text-[#152033]">添加用户</h3>
            <p className="text-xs text-[#637089]">创建新的系统用户账号</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {fieldError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-[#E5484D]">
              {fieldError}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-[#152033]">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-[#C8CDD8] text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]"
              placeholder="登录用户名"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#152033]">显示名称</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-[#C8CDD8] text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]"
              placeholder="显示在系统中的名称"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#152033]">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-[#C8CDD8] text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]"
              placeholder="初始密码（至少6位）"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#152033]">角色</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-[#C8CDD8] text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF] bg-white"
            >
              <option value="intern">实习生</option>
              <option value="admin">管理员</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                reset()
                onClose()
              }}
              className="px-4 py-2 text-sm font-medium text-[#637089] hover:text-[#152033] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#2F6BFF] text-white rounded-md text-sm font-medium hover:bg-[#1a5ae0] disabled:opacity-60 transition-colors inline-flex items-center gap-1.5"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "添加中..." : "添加用户"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Reset Password Dialog ───────────────────────────────────────────
function ResetPwdDialog({
  open,
  targetUser,
  onClose,
  onSuccess,
  onError,
}: {
  open: boolean
  targetUser: UserInfo | null
  onClose: () => void
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [newPwd, setNewPwd] = useState("")
  const [loading, setLoading] = useState(false)
  const [fieldError, setFieldError] = useState("")

  const reset = () => {
    setNewPwd("")
    setFieldError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldError("")

    if (!newPwd || newPwd.length < 6) {
      setFieldError("密码长度不能少于6位")
      return
    }
    if (!targetUser) return

    setLoading(true)
    try {
      await resetUserPwd(targetUser.id, newPwd)
      reset()
      onSuccess(`已重置用户 "${targetUser.display_name || targetUser.username}" 的密码`)
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "重置密码失败"
      setFieldError(msg)
      onError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!open || !targetUser) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl border border-[#E6EAF2] p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-[#FFF3E0] flex items-center justify-center">
            <RefreshCw className="h-5 w-5 text-[#F59E0B]" />
          </div>
          <div>
            <h3 className="font-semibold text-[#152033]">重置密码</h3>
            <p className="text-xs text-[#637089]">
              用户: {targetUser.display_name || targetUser.username}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {fieldError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-[#E5484D]">
              {fieldError}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-[#152033]">新密码</label>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-[#C8CDD8] text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]"
              placeholder="新密码（至少6位）"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                reset()
                onClose()
              }}
              className="px-4 py-2 text-sm font-medium text-[#637089] hover:text-[#152033] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#F59E0B] text-white rounded-md text-sm font-medium hover:bg-[#d48806] disabled:opacity-60 transition-colors inline-flex items-center gap-1.5"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "重置中..." : "确认重置"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Profile Page ───────────────────────────────────────────────
export default function ProfilePage() {
  const user = getUser()
  const isAdmin = user?.role === "admin"

  // User management state
  const [users, setUsers] = useState<UserInfo[]>([])
  const [usersLoading, setUsersLoading] = useState(false)

  // Dialog states
  const [showChangePwd, setShowChangePwd] = useState(false)
  const [showAddUser, setShowAddUser] = useState(false)
  const [resetTarget, setResetTarget] = useState<UserInfo | null>(null)

  // Toast
  const [toast, setToast] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message })
  }, [])

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const data = await getUsers()
      setUsers(data)
    } catch {
      showToast("error", "获取用户列表失败")
    } finally {
      setUsersLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (isAdmin) fetchUsers()
  }, [isAdmin, fetchUsers])

  // Toggle user active
  const handleToggleActive = async (u: UserInfo) => {
    try {
      const result = await toggleUserActive(u.id)
      showToast("success", `用户 "${u.display_name || u.username}" 已${result.is_active ? "启用" : "禁用"}`)
      fetchUsers()
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "操作失败"
      showToast("error", msg)
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <AppNav />
      <main className="max-w-[1600px] mx-auto px-4 xl:px-6 py-6 xl:py-8">
        <h1 className="text-2xl font-bold text-[#152033] mb-6">个人中心</h1>

        {/* Toast */}
        {toast && (
          <Toast
            type={toast.type}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Account Info Card */}
          <div className="bg-white rounded-xl border border-[#E6EAF2] p-6">
            <h2 className="text-sm font-semibold text-[#637089] uppercase tracking-wide mb-5">
              账号信息
            </h2>

            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-full bg-[#DEE8FF] flex items-center justify-center mb-3">
                <User className="h-8 w-8 text-[#2F6BFF]" />
              </div>
              <div className="text-lg font-bold text-[#152033]">
                {user?.display_name || user?.username || "用户"}
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 mt-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full",
                  isAdmin
                    ? "bg-[#DEE8FF] text-[#2F6BFF]"
                    : "bg-[#E8F5E9] text-[#16A37B]",
                )}
              >
                {isAdmin ? (
                  <ShieldCheck className="h-3 w-3" />
                ) : (
                  <Shield className="h-3 w-3" />
                )}
                {isAdmin ? "管理员" : "实习生"}
              </span>
            </div>

            <div className="space-y-3 border-t border-[#E6EAF2] pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#637089]">用户名</span>
                <span className="text-sm font-medium text-[#152033]">
                  {user?.username || "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#637089]">显示名称</span>
                <span className="text-sm font-medium text-[#152033]">
                  {user?.display_name || user?.username || "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#637089]">角色</span>
                <span className="text-sm font-medium text-[#152033]">
                  {isAdmin ? "管理员" : "实习生"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#637089]">密码状态</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                    user?.password_changed
                      ? "bg-[#E8F5E9] text-[#16A37B]"
                      : "bg-[#FFF3E0] text-[#F59E0B]",
                  )}
                >
                  {user?.password_changed ? "已修改" : "初始密码"}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowChangePwd(true)}
              className="w-full mt-5 inline-flex items-center justify-center gap-2 px-4 py-2 border border-[#C8CDD8] rounded-md text-sm font-medium text-[#152033] hover:bg-[#EDF0F7] transition-colors"
            >
              <Key className="h-4 w-4" />
              修改密码
            </button>
          </div>

          {/* User Management (Admin Only) */}
          <div className="xl:col-span-2">
            {isAdmin ? (
              <div className="bg-white rounded-xl border border-[#E6EAF2]">
                <div className="flex items-center justify-between p-6 pb-4 border-b border-[#E6EAF2]">
                  <div>
                    <h2 className="text-sm font-semibold text-[#637089] uppercase tracking-wide">
                      用户管理
                    </h2>
                    <p className="text-xs text-[#637089] mt-0.5">
                      管理系统用户账号
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddUser(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#2F6BFF] text-white rounded-md text-sm font-medium hover:bg-[#1a5ae0] transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    添加用户
                  </button>
                </div>

                {usersLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#E6EAF2] border-t-[#2F6BFF]" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <User className="h-10 w-10 text-[#C8CDD8] mb-3" />
                    <p className="text-sm text-[#637089]">暂无用户数据</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E6EAF2] bg-[#F6F8FB]">
                          <th className="text-left px-4 py-3 font-medium text-[#637089] whitespace-nowrap">
                            用户名
                          </th>
                          <th className="text-left px-4 py-3 font-medium text-[#637089] whitespace-nowrap">
                            显示名称
                          </th>
                          <th className="text-center px-4 py-3 font-medium text-[#637089] whitespace-nowrap">
                            角色
                          </th>
                          <th className="text-center px-4 py-3 font-medium text-[#637089] whitespace-nowrap">
                            状态
                          </th>
                          <th className="text-center px-4 py-3 font-medium text-[#637089] whitespace-nowrap">
                            密码
                          </th>
                          <th className="text-center px-4 py-3 font-medium text-[#637089] whitespace-nowrap w-36">
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr
                            key={u.id}
                            className="border-b border-[#E6EAF2] hover:bg-[#F6F8FB] transition-colors last:border-0"
                          >
                            <td className="px-4 py-3 font-medium text-[#152033]">
                              {u.username}
                            </td>
                            <td className="px-4 py-3 text-[#637089]">
                              {u.display_name || "-"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                                  u.role === "admin"
                                    ? "bg-[#DEE8FF] text-[#2F6BFF]"
                                    : "bg-[#E8F5E9] text-[#16A37B]",
                                )}
                              >
                                {u.role === "admin" ? "管理员" : "实习生"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                                  u.is_active
                                    ? "bg-[#E8F5E9] text-[#16A37B]"
                                    : "bg-red-50 text-[#E5484D]",
                                )}
                              >
                                {u.is_active ? "已启用" : "已禁用"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                                  u.password_changed
                                    ? "bg-[#E8F5E9] text-[#16A37B]"
                                    : "bg-[#FFF3E0] text-[#F59E0B]",
                                )}
                              >
                                {u.password_changed ? "已修改" : "初始"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => setResetTarget(u)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-[#C8CDD8] text-[#637089] hover:bg-[#EDF0F7] transition-colors"
                                  title="重置密码"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                  重置密码
                                </button>
                                <button
                                  onClick={() => handleToggleActive(u)}
                                  className={cn(
                                    "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors",
                                    u.is_active
                                      ? "border-[#E5484D]/30 text-[#E5484D] hover:bg-red-50"
                                      : "border-[#16A37B]/30 text-[#16A37B] hover:bg-green-50",
                                  )}
                                  title={
                                    u.is_active ? "禁用账号" : "启用账号"
                                  }
                                >
                                  {u.is_active ? (
                                    <>
                                      <Lock className="h-3.5 w-3.5" />
                                      禁用
                                    </>
                                  ) : (
                                    <>
                                      <Unlock className="h-3.5 w-3.5" />
                                      启用
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              /* Non-admin: permission notice */
              <div className="bg-white rounded-xl border border-[#E6EAF2] p-12">
                <div className="flex flex-col items-center text-center">
                  <Shield className="h-10 w-10 text-[#C8CDD8] mb-3" />
                  <p className="text-sm font-medium text-[#637089]">
                    用户管理仅限管理员操作
                  </p>
                  <p className="text-xs text-[#637089] mt-1">
                    如需相关权限，请联系系统管理员
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dialogs */}
        <ChangePasswordDialog
          open={showChangePwd}
          onClose={() => setShowChangePwd(false)}
          onSuccess={(msg) => showToast("success", msg)}
          onError={(msg) => showToast("error", msg)}
        />

        <AddUserDialog
          open={showAddUser}
          onClose={() => setShowAddUser(false)}
          onSuccess={(msg) => {
            showToast("success", msg)
            fetchUsers()
          }}
          onError={(msg) => showToast("error", msg)}
        />

        <ResetPwdDialog
          open={!!resetTarget}
          targetUser={resetTarget}
          onClose={() => setResetTarget(null)}
          onSuccess={(msg) => showToast("success", msg)}
          onError={(msg) => showToast("error", msg)}
        />
      </main>
    </div>
  )
}
