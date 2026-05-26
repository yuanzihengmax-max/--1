import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { changePwd } from "@/lib/api"

export default function ChangePasswordPage() {
  const [oldP, setOldP] = useState("")
  const [newP, setNewP] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("")
    if (newP.length < 6) { setError("新密码长度不能少于6位"); return }
    if (newP !== confirm) { setError("两次输入不一致"); return }
    if (oldP === newP) { setError("新密码不能与旧密码相同"); return }
    setLoading(true)
    try {
      await changePwd(oldP, newP)
      const raw = localStorage.getItem("auth-storage-v2")
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.state?.user) parsed.state.user.password_changed = true
        localStorage.setItem("auth-storage-v2", JSON.stringify(parsed))
      }
      navigate("/dashboard")
    } catch (err: any) {
      setError(err.response?.data?.detail || "修改失败")
    } finally { setLoading(false) }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md mx-4 bg-white rounded-xl shadow-card border border-gray-100 p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[#DEE8FF] mb-3">
            <svg className="h-6 w-6 text-[#2F6BFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#152033]">首次登录，请修改密码</h1>
          <p className="text-sm text-[#637089] mt-1">为了账号安全，需修改初始密码</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-[#E5484D]">{error}</div>}
          {["旧密码", "新密码", "确认新密码"].map((label, i) => (
            <div key={i}><label className="text-sm font-medium text-[#152033]">{label}</label>
              <input type="password" value={i===0?oldP:i===1?newP:confirm}
                onChange={e => (i===0?setOldP:i===1?setNewP:setConfirm)(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-md border border-[#C8CDD8] text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]"
                placeholder={i===0?"请输入旧密码":"请输入新密码（至少6位）"} required /></div>
          ))}
          <button type="submit" disabled={loading}
            className="w-full py-2 bg-[#2F6BFF] text-white rounded-md text-sm font-medium hover:bg-[#1a5ae0] disabled:opacity-60">
            {loading ? "提交中..." : "确认修改"}</button>
        </form>
      </div>
    </div>
  )
}
