import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createCandidate } from "@/lib/api"
import type { Candidate } from "@/types"

const DEPARTMENTS = ["直销中心"] as const
const POSITIONS = ["销售代表"] as const
const CHANNELS = [
  "BOSS", "智联", "前程无忧", "猎聘",
  "新媒体（小红书、抖音等）", "内推", "校招线下双选会", "实习僧", "其他",
] as const
const EDUCATION_OPTIONS = ["本科（全日制）", "专转本（非全日制）", "专转本（全日制）", "硕士", "专科（全日制）", "专科（非全日制）"]
const GENDER_OPTIONS = ["男", "女"]

export interface ParsedInfo {
  name: string | null
  phone: string | null
  email: string | null
  gender: string | null
  birth_year: number | null
  school: string | null
  major: string | null
  education: string | null
  is_fresh_grad: string | null
  channel: string | null
}

interface ImportFormData {
  name: string; phone: string; email: string; gender: string
  birth_year: string; school: string; major: string; education: string
  is_fresh_grad: string; channel: string; department: string; position: string
  evaluator: string; interviewer: string; result: string; communicate_time: string
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem("auth-storage-v2")
    if (!raw) return null
    return JSON.parse(raw).state?.user ?? null
  } catch { return null }
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: (candidate: Candidate) => void
  result: { filename: string; extracted: ParsedInfo } | null
  defaultResult?: "推荐" | "淘汰"
}

export default function ResumeParseDialog({ open, onOpenChange, onImported, result, defaultResult = "推荐" }: Props) {
  const user = getCurrentUser()
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const [form, setForm] = useState<ImportFormData>({
    name: "", phone: "", email: "", gender: "", birth_year: "",
    school: "", major: "", education: "", is_fresh_grad: "", channel: "",
    department: "直销中心", position: "销售代表",
    evaluator: user?.display_name || "", interviewer: "",
    result: defaultResult, communicate_time: todayStr(),
  })

  // Pre-fill form when result arrives
  useEffect(() => {
    if (open && result) {
      const info = result.extracted
      setForm({
        name: info.name || "",
        phone: info.phone || "",
        email: info.email || "",
        gender: info.gender || "",
        birth_year: info.birth_year ? String(info.birth_year) : "",
        school: info.school || "",
        major: info.major || "",
        education: info.education || "",
        is_fresh_grad: info.is_fresh_grad || "",
        channel: info.channel || "",
        department: "直销中心",
        position: "销售代表",
        evaluator: user?.display_name || "",
        interviewer: "",
        result: defaultResult,
        communicate_time: todayStr(),
      })
      setError(null)
    }
  }, [open, result, defaultResult, user])

  const updateForm = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleImport = async () => {
    setImporting(true)
    setError(null)
    try {
      const created = await createCandidate({
        ...form,
        birth_year: form.birth_year ? parseInt(form.birth_year, 10) : undefined,
      } as Partial<Candidate>)
      onImported(created)
      onOpenChange(false)
    } catch (err: any) {
      setError(err?.response?.data?.detail || "导入失败")
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-[#152033]">
            简历识别结果
          </DialogTitle>
          {result && (
            <p className="text-sm text-[#637089] mt-1">
              文件：{result.filename}
            </p>
          )}
        </DialogHeader>

        {result && (
          <div className="space-y-5 py-2">
            {/* Basic info */}
            <div>
              <h3 className="text-sm font-medium text-[#152033] mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-[#2F6BFF] rounded-full" />
                基本信息（AI 识别结果，可修改）
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["name", "姓名", "text"],
                  ["phone", "手机号", "text"],
                  ["email", "邮箱", "text"],
                ].map(([key, label, type]) => (
                  <div key={key}>
                    <label className="text-xs text-[#637089] mb-1 block">{label}</label>
                    <input
                      type={type as string}
                      value={(form as any)[key]}
                      onChange={e => updateForm(key, e.target.value)}
                      className="w-full rounded-md border border-[#C8CDD8] px-3 py-2 text-sm text-[#152033] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-[#637089] mb-1 block">性别</label>
                  <select value={form.gender} onChange={e => updateForm("gender", e.target.value)}
                    className="w-full rounded-md border border-[#C8CDD8] px-3 py-2 text-sm text-[#152033] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF] bg-white">
                    <option value="">请选择</option>
                    {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#637089] mb-1 block">出生年份</label>
                  <input type="text" value={form.birth_year} onChange={e => updateForm("birth_year", e.target.value)}
                    placeholder="如 2000"
                    className="w-full rounded-md border border-[#C8CDD8] px-3 py-2 text-sm text-[#152033] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]" />
                </div>
                <div>
                  <label className="text-xs text-[#637089] mb-1 block">学历</label>
                  <select value={form.education} onChange={e => updateForm("education", e.target.value)}
                    className="w-full rounded-md border border-[#C8CDD8] px-3 py-2 text-sm text-[#152033] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF] bg-white">
                    <option value="">请选择</option>
                    {EDUCATION_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#637089] mb-1 block">毕业院校</label>
                  <input type="text" value={form.school} onChange={e => updateForm("school", e.target.value)}
                    className="w-full rounded-md border border-[#C8CDD8] px-3 py-2 text-sm text-[#152033] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]" />
                </div>
                <div>
                  <label className="text-xs text-[#637089] mb-1 block">专业</label>
                  <input type="text" value={form.major} onChange={e => updateForm("major", e.target.value)}
                    className="w-full rounded-md border border-[#C8CDD8] px-3 py-2 text-sm text-[#152033] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]" />
                </div>
                <div>
                  <label className="text-xs text-[#637089] mb-1 block">应届生</label>
                  <select value={form.is_fresh_grad} onChange={e => updateForm("is_fresh_grad", e.target.value)}
                    className="w-full rounded-md border border-[#C8CDD8] px-3 py-2 text-sm text-[#152033] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF] bg-white">
                    <option value="">请选择</option>
                    <option value="是">是</option>
                    <option value="否">否</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#637089] mb-1 block">招聘渠道</label>
                  <select value={form.channel} onChange={e => updateForm("channel", e.target.value)}
                    className="w-full rounded-md border border-[#C8CDD8] px-3 py-2 text-sm text-[#152033] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF] bg-white">
                    <option value="">请选择</option>
                    {CHANNELS.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t border-[#E5E7EB]" />

            {/* Candidate info */}
            <div>
              <h3 className="text-sm font-medium text-[#152033] mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-[#2F6BFF] rounded-full" />
                候选人信息
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#637089] mb-1 block">沟通时间</label>
                  <input type="text" value={form.communicate_time} onChange={e => updateForm("communicate_time", e.target.value)}
                    className="w-full rounded-md border border-[#C8CDD8] px-3 py-2 text-sm text-[#152033] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]" />
                </div>
                <div>
                  <label className="text-xs text-[#637089] mb-1 block">部门</label>
                  <select value={form.department} onChange={e => updateForm("department", e.target.value)}
                    className="w-full rounded-md border border-[#C8CDD8] px-3 py-2 text-sm text-[#152033] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF] bg-white">
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#637089] mb-1 block">岗位</label>
                  <select value={form.position} onChange={e => updateForm("position", e.target.value)}
                    className="w-full rounded-md border border-[#C8CDD8] px-3 py-2 text-sm text-[#152033] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF] bg-white">
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#637089] mb-1 block">评估人</label>
                  <input type="text" value={form.evaluator} onChange={e => updateForm("evaluator", e.target.value)}
                    className="w-full rounded-md border border-[#C8CDD8] px-3 py-2 text-sm text-[#152033] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]" />
                </div>
                <div>
                  <label className="text-xs text-[#637089] mb-1 block">面试官</label>
                  <input type="text" value={form.interviewer} onChange={e => updateForm("interviewer", e.target.value)}
                    className="w-full rounded-md border border-[#C8CDD8] px-3 py-2 text-sm text-[#152033] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]" />
                </div>
                <div>
                  <label className="text-xs text-[#637089] mb-1 block">导入台账</label>
                  <select value={form.result} onChange={e => updateForm("result", e.target.value)}
                    className="w-full rounded-md border border-[#C8CDD8] px-3 py-2 text-sm text-[#152033] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF] bg-white">
                    <option value="推荐">推荐台账</option>
                    <option value="淘汰">淘汰台账</option>
                  </select>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-[#E5484D] bg-red-50 px-4 py-2 rounded-md">{error}</p>
            )}
          </div>
        )}

        {/* Footer */}
        {result && (
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E5E7EB]">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-md text-sm font-medium text-[#152033] bg-[#EDF0F7] hover:bg-gray-200"
            >
              取消
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-4 py-2 rounded-md text-sm font-medium text-white bg-[#2F6BFF] hover:bg-[#1a5ae0] disabled:opacity-50"
            >
              {importing ? "导入中..." : "确认导入"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
