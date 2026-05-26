import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { loginApi } from "@/lib/api"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true)
    try {
      const data = await loginApi(username, password)
      localStorage.setItem("auth-storage-v2", JSON.stringify({ state: { token: data.token, user: data.user }, version: 0 }))
      navigate("/dashboard")
    } catch (err: any) {
      setError(err.response?.data?.detail || "登录失败")
    } finally { setLoading(false) }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md mx-4 bg-white rounded-xl shadow-card border border-gray-100 p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[#DEE8FF] mb-3">
            <svg className="h-6 w-6 text-[#2F6BFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#152033]">招聘简历数据自动化台账</h1>
          <p className="text-sm text-[#637089] mt-1">请使用账号密码登录系统</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-[#E5484D]">{error}</div>}
          <div><label className="text-sm font-medium text-[#152033]">用户名</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-[#C8CDD8] text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]"
              placeholder="请输入用户名" required /></div>
          <div><label className="text-sm font-medium text-[#152033]">密码</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-[#C8CDD8] text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]"
              placeholder="请输入密码" required /></div>
          <button type="submit" disabled={loading}
            className="w-full py-2 bg-[#2F6BFF] text-white rounded-md text-sm font-medium hover:bg-[#1a5ae0] disabled:opacity-60">
            {loading ? "登录中..." : "登录"}</button>
        </form>
      </div>
    </div>
  )
}
