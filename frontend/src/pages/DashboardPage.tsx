import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import AppNav from "@/components/AppNav"
import { getDailyStats, parseResume, createCandidate } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { DailyStats, Candidate } from "@/types"
import {
  FileUp, BarChart3, PieChart, ArrowRight,
  TrendingUp, TrendingDown, Minus, Loader2, FileText, CheckCircle2,
  AlertCircle, Eye, RotateCcw, ChevronDown, ChevronUp, Save, X,
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────
interface Metric {
  key: string; label: string; today: number; yesterday: number; change: number; rate: string
}

interface ParsedInfo {
  name: string | null; phone: string | null; email: string | null
  gender: string | null; birth_year: number | null; school: string | null
  major: string | null; education: string | null; is_fresh_grad: string | null; channel: string | null
}

interface ParseRecord {
  id: string; filename: string; status: "parsing" | "success" | "error"
  result?: { filename: string; extracted: ParsedInfo }; error?: string
}

interface ReviewForm {
  name: string; phone: string; email: string; gender: string; birth_year: string
  school: string; major: string; education: string; is_fresh_grad: string; channel: string
  department: string; position: string; evaluator: string; interviewer: string
  result: string; communicate_time: string
  pushed_to_dept: boolean; dept_eval_passed: boolean; first_interview_show: boolean
  interview_invited: boolean; second_interview: boolean; second_interview_show: boolean; offer_sent: boolean
}

const PIPELINE_LABELS: { key: keyof ReviewForm; label: string }[] = [
  { key: "pushed_to_dept", label: "电筛通过" },
  { key: "dept_eval_passed", label: "初试邀约" },
  { key: "first_interview_show", label: "初试到面" },
  { key: "interview_invited", label: "初试通过" },
  { key: "second_interview", label: "复试邀约" },
  { key: "second_interview_show", label: "复试到面" },
  { key: "offer_sent", label: "复试通过" },
]

// ─── Module-level store ──────────────────────────────────────────────
let _idCounter = 0
function nextId(): string { _idCounter++; return `p-${Date.now()}-${_idCounter}` }

let _records: ParseRecord[] = []
let _listeners: Array<() => void> = []
function getStore() { return _records }
function updateStore(updater: (prev: ParseRecord[]) => ParseRecord[]) {
  _records = updater(_records)
  _listeners.forEach(fn => fn())
}
function subscribe(fn: () => void) {
  _listeners.push(fn)
  return () => { _listeners = _listeners.filter(f => f !== fn) }
}

// ─── Constants ───────────────────────────────────────────────────────
const CHANNELS = ["BOSS","智联","前程无忧","猎聘","新媒体（小红书、抖音等）","内推","校招线下双选会","实习僧","其他"]
const EDU_OPTS = ["本科（全日制）","专转本（非全日制）","专转本（全日制）","硕士","专科（全日制）","专科（非全日制）"]
const GENDER_OPTS = ["男","女"]
const POSITIONS = ["销售专员", "正式员工", "日常实习生"]

const METRIC_CONFIGS: { key: keyof DailyStats["today"]; label: string }[] = [
  { key: "pushed_to_dept", label: "电筛通过" },
  { key: "dept_eval_passed", label: "初试邀约" },
  { key: "first_interview_show", label: "初试到面" },
  { key: "interview_invited", label: "初试通过" },
  { key: "second_interview", label: "复试邀约" },
  { key: "second_interview_show", label: "复试到面" },
  { key: "offer_sent", label: "复试通过" },
]

const QUICK_ACTIONS = [
  { label: "查看日报", icon: BarChart3, path: "/daily-report", desc: "查看每日工作记录" },
  { label: "查看周报", icon: PieChart, path: "/weekly-report", desc: "查看每周工作汇总" },
]

// ─── Helpers ─────────────────────────────────────────────────────────
function getUser() {
  try { const raw = localStorage.getItem("auth-storage-v2"); if (!raw) return null; return JSON.parse(raw).state?.user ?? null } catch { return null }
}
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` }

function emptyForm(user: any, defaultResult = "推荐"): ReviewForm {
  return {
    name:"", phone:"", email:"", gender:"", birth_year:"", school:"", major:"", education:"",
    is_fresh_grad:"", channel:"", department:"", position:"销售代表",
    evaluator: user?.display_name || "", interviewer:"", result: defaultResult, communicate_time: todayStr(),
    pushed_to_dept: defaultResult === "推荐", dept_eval_passed: false,
    first_interview_show: false, interview_invited: false,
    second_interview: false, second_interview_show: false, offer_sent: false,
  }
}

function infoToForm(info: ParsedInfo, user: any, defaultResult = "推荐"): ReviewForm {
  return {
    name: info.name || "", phone: info.phone || "", email: info.email || "",
    gender: info.gender || "", birth_year: info.birth_year ? String(info.birth_year) : "",
    school: info.school || "", major: info.major || "", education: info.education || "",
    is_fresh_grad: info.is_fresh_grad || "", channel: info.channel || "",
    department: "", position: "销售代表",
    evaluator: user?.display_name || "", interviewer: "", result: defaultResult, communicate_time: todayStr(),
    pushed_to_dept: defaultResult === "推荐", dept_eval_passed: false,
    first_interview_show: false, interview_invited: false,
    second_interview: false, second_interview_show: false, offer_sent: false,
  }
}

// ─── Inline Review Panel ─────────────────────────────────────────────
function ReviewPanel({ record, onClose, onImported }: {
  record: ParseRecord
  onClose: () => void
  onImported: () => void
}) {
  const user = getUser()
  const parsed = record.result?.extracted
  const [form, setForm] = useState<ReviewForm>(() => parsed ? infoToForm(parsed, user) : emptyForm(user))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true); setErr(null)
    try {
      await createCandidate({ ...form, birth_year: form.birth_year ? parseInt(form.birth_year, 10) : undefined } as Partial<Candidate>)
      onImported()
      onClose()
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "导入失败")
    } finally { setSaving(false) }
  }

  return (
    <div className="border-t-2 border-[#2F6BFF] bg-[#F8FAFC] rounded-b-xl px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#152033] flex items-center gap-2">
          <span className="w-1 h-4 bg-[#2F6BFF] rounded-full" />
          审核导入 — {record.filename}
        </h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-200 text-[#637089]"><X className="h-4 w-4" /></button>
      </div>

      {/* Basic info */}
      <div>
        <p className="text-xs font-medium text-[#637089] mb-2">基本信息（AI识别，可修改）</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {[
            ["name","姓名","text"], ["phone","手机号","text"], ["email","邮箱","text"],
          ].map(([k, lbl, t]) => (
            <div key={k}><label className="text-[11px] text-[#637089]">{lbl}</label>
              <input type={t as string} value={(form as any)[k]} onChange={e => set(k, e.target.value)}
                className="w-full mt-0.5 rounded border border-[#C8CDD8] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2F6BFF]" />
            </div>
          ))}
          <div><label className="text-[11px] text-[#637089]">性别</label>
            <select value={form.gender} onChange={e => set("gender", e.target.value)}
              className="w-full mt-0.5 rounded border border-[#C8CDD8] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2F6BFF] bg-white">
              <option value="">-</option>{GENDER_OPTS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
          <div><label className="text-[11px] text-[#637089]">出生年份</label>
            <input type="text" value={form.birth_year} onChange={e => set("birth_year", e.target.value)} placeholder="如 2000"
              className="w-full mt-0.5 rounded border border-[#C8CDD8] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2F6BFF]" /></div>
          <div><label className="text-[11px] text-[#637089]">学历</label>
            <select value={form.education} onChange={e => set("education", e.target.value)}
              className="w-full mt-0.5 rounded border border-[#C8CDD8] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2F6BFF] bg-white">
              <option value="">-</option>{EDU_OPTS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
          <div><label className="text-[11px] text-[#637089]">毕业院校</label>
            <input type="text" value={form.school} onChange={e => set("school", e.target.value)}
              className="w-full mt-0.5 rounded border border-[#C8CDD8] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2F6BFF]" /></div>
          <div><label className="text-[11px] text-[#637089]">专业</label>
            <input type="text" value={form.major} onChange={e => set("major", e.target.value)}
              className="w-full mt-0.5 rounded border border-[#C8CDD8] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2F6BFF]" /></div>
          <div><label className="text-[11px] text-[#637089]">应届生</label>
            <select value={form.is_fresh_grad} onChange={e => set("is_fresh_grad", e.target.value)}
              className="w-full mt-0.5 rounded border border-[#C8CDD8] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2F6BFF] bg-white">
              <option value="">-</option><option value="是">是</option><option value="否">否</option></select></div>
          <div><label className="text-[11px] text-[#637089]">招聘渠道</label>
            <select value={form.channel} onChange={e => set("channel", e.target.value)}
              className="w-full mt-0.5 rounded border border-[#C8CDD8] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2F6BFF] bg-white">
              <option value="">-</option>{CHANNELS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
        </div>
      </div>

      {/* Candidate info */}
      <div>
        <p className="text-xs font-medium text-[#637089] mb-2">候选人信息</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <div><label className="text-[11px] text-[#637089]">沟通时间</label>
            <input type="text" value={form.communicate_time} onChange={e => set("communicate_time", e.target.value)}
              className="w-full mt-0.5 rounded border border-[#C8CDD8] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2F6BFF]" /></div>
          <div><label className="text-[11px] text-[#637089]">备注</label>
            <input type="text" value={form.department} onChange={e => set("department", e.target.value)}
              placeholder="特殊情况备注"
              className="w-full mt-0.5 rounded border border-[#C8CDD8] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2F6BFF]" /></div>
          <div><label className="text-[11px] text-[#637089]">岗位</label>
            <select value={form.position} onChange={e => set("position", e.target.value)}
              className="w-full mt-0.5 rounded border border-[#C8CDD8] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2F6BFF] bg-white">
              <option value="销售代表">销售代表</option></select></div>
          <div><label className="text-[11px] text-[#637089]">评估人</label>
            <input type="text" value={form.evaluator} onChange={e => set("evaluator", e.target.value)}
              className="w-full mt-0.5 rounded border border-[#C8CDD8] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2F6BFF]" /></div>
          <div><label className="text-[11px] text-[#637089]">面试官</label>
            <input type="text" value={form.interviewer} onChange={e => set("interviewer", e.target.value)}
              className="w-full mt-0.5 rounded border border-[#C8CDD8] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2F6BFF]" /></div>
          <div><label className="text-[11px] text-[#637089]">导入台账</label>
            <select value={form.result} onChange={e => set("result", e.target.value)}
              className="w-full mt-0.5 rounded border border-[#C8CDD8] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2F6BFF] bg-white">
              <option value="推荐">推荐台账</option><option value="淘汰">淘汰台账</option></select></div>
        </div>
      </div>

      {/* Pipeline flags */}
      <div>
        <p className="text-xs font-medium text-[#637089] mb-2">面试流程</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {PIPELINE_LABELS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={!!(form as any)[key]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.checked }))}
                className="w-3.5 h-3.5 rounded border-[#C8CDD8] text-[#2F6BFF] focus:ring-[#2F6BFF]" />
              <span className="text-xs text-[#152033]">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {err && <p className="text-xs text-[#E5484D] bg-red-50 px-3 py-2 rounded">{err}</p>}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button onClick={onClose}
          className="px-3 py-1.5 rounded text-xs font-medium text-[#637089] bg-[#EDF0F7] hover:bg-gray-200">取消</button>
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-1.5 rounded text-xs font-medium text-white bg-[#2F6BFF] hover:bg-[#1a5ae0] disabled:opacity-50 flex items-center gap-1">
          <Save className="h-3 w-3" />{saving ? "导入中..." : "确认导入"}</button>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate()
  const user = getUser()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [stats, setStats] = useState<DailyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [records, setRecords] = useState<ParseRecord[]>(getStore)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => subscribe(() => setRecords(getStore())), [])

  const updateRecords = useCallback((updater: (prev: ParseRecord[]) => ParseRecord[]) => {
    updateStore(updater); setRecords(getStore())
  }, [])

  const fetchStats = useCallback(() => {
    const today = new Date().toISOString().split("T")[0]
    getDailyStats({ date: today }).then(setStats).catch((err) => {
      setError(err?.response?.data?.detail || err?.message || "获取统计数据失败")
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  // ─── Parse logic ─────────────────────────────────────────────────
  const parseFiles = async (files: File[]) => {
    const pdfs = files.filter(f => f.name.toLowerCase().endsWith(".pdf"))
    if (pdfs.length === 0) return
    setUploading(true)

    const newRecords: ParseRecord[] = pdfs.map(f => ({ id: nextId(), filename: f.name, status: "parsing" as const }))
    updateRecords(prev => [...newRecords, ...prev].slice(0, 10))

    for (let i = 0; i < pdfs.length; i++) {
      const rid = newRecords[i]?.id; if (!rid) continue
      try {
        const r = await parseResume(pdfs[i])
        updateStore(prev => prev.map(rec => rec.id === rid
          ? { ...rec, status: "success" as const, result: { filename: r.filename, extracted: r.extracted } } : rec))
        setRecords(getStore())
      } catch (err: any) {
        const msg = err?.response?.data?.detail || err?.message || "解析失败"
        updateStore(prev => prev.map(rec => rec.id === rid ? { ...rec, status: "error" as const, error: msg } : rec))
        setRecords(getStore())
      }
    }
    setUploading(false)
  }

  // ─── Drag & drop ──────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true) }
  const handleDragLeave = () => setDragOver(false)
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length > 0) parseFiles(Array.from(e.dataTransfer.files)) }
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.length) parseFiles(Array.from(e.target.files)); if (fileInputRef.current) fileInputRef.current.value = "" }

  // ─── Derived ──────────────────────────────────────────────────────
  const metrics: Metric[] = stats ? METRIC_CONFIGS.map(cfg => ({
    key: cfg.key, label: cfg.label,
    today: stats.today[cfg.key] ?? 0, yesterday: stats.yesterday[cfg.key] ?? 0,
    change: stats.changes[cfg.key] ?? 0, rate: stats.changeRates?.[cfg.key] ?? "-",
  })) : []

  const roleDesc = user?.role === "admin" ? "系统管理员 · 全权限管理" : "招聘实习生 · 日常招聘运营"
  const displayName = user?.display_name || user?.username || "用户"

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <AppNav />
      <main className="max-w-[1600px] mx-auto px-4 xl:px-6 py-6 xl:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#152033]">欢迎回来，{displayName}</h1>
          <p className="text-[#637089] mt-1">{roleDesc}</p>
        </div>

        {/* PDF Import Card */}
        <div className="bg-white rounded-xl border border-[#E6EAF2] shadow-sm mb-6 overflow-hidden">
          <div
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl m-4 p-6 xl:p-8 flex flex-col items-center gap-3 cursor-pointer transition-all",
              dragOver ? "border-[#2F6BFF]/60 bg-[#F0F4FF]" : "border-[#C8CDD8] hover:border-[#2F6BFF]/40 hover:bg-[#F8FAFC]",
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="h-10 w-10 text-[#2F6BFF] animate-spin" />
                <p className="text-sm font-medium text-[#152033]">正在上传解析...</p>
                <p className="text-xs text-[#637089]">请勿关闭页面</p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-[#2F6BFF] flex items-center justify-center shadow-lg shadow-[#2F6BFF]/20">
                  <FileUp className="h-7 w-7 text-white" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-[#152033]">拖拽 PDF 简历到此处，或点击上传</p>
                  <p className="text-xs text-[#637089] mt-1">支持批量导入，每次最多 10 个文件</p>
                </div>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleFileSelect} />

          {/* Records list */}
          {records.length > 0 && (
            <div className="border-t border-[#E6EAF2]">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#F0F2F5]">
                <FileText className="h-4 w-4 text-[#637089]" />
                <span className="text-xs font-medium text-[#637089]">
                  解析记录 ({records.filter(r => r.status === "success").length}/{records.length})
                </span>
              </div>
              {records.map((record) => (
                <div key={record.id}>
                  <div className="flex items-center justify-between py-2.5 px-4 hover:bg-[#F6F8FB] transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      {record.status === "parsing" && <Loader2 className="h-4 w-4 text-[#F59E0B] animate-spin shrink-0" />}
                      {record.status === "success" && <CheckCircle2 className="h-4 w-4 text-[#16A37B] shrink-0" />}
                      {record.status === "error" && <AlertCircle className="h-4 w-4 text-[#E5484D] shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm text-[#152033] truncate">{record.filename}</p>
                        {record.status === "error" && record.error && <p className="text-xs text-[#E5484D] truncate">{record.error}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn("text-xs rounded-full px-2 py-0.5 font-medium",
                        record.status === "parsing" && "bg-[#FEF3C7] text-[#D97706]",
                        record.status === "success" && "bg-[#D1FAE5] text-[#059669]",
                        record.status === "error" && "bg-[#FEE2E2] text-[#DC2626]",
                      )}>
                        {record.status === "parsing" ? "识别中" : record.status === "success" ? "已识别" : "失败"}
                      </span>
                      {record.status === "success" && (
                        <button onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === record.id ? null : record.id) }}
                          className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                            expandedId === record.id ? "bg-[#2F6BFF] text-white" : "text-[#2F6BFF] hover:bg-[#DEE8FF]")}>
                          {expandedId === record.id ? <ChevronUp className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          {expandedId === record.id ? "收起" : "查看"}
                        </button>
                      )}
                      {record.status === "error" && (
                        <button onClick={(e) => { e.stopPropagation(); updateRecords(prev => prev.filter(r => r.id !== record.id)) }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-[#637089] hover:bg-[#EDF0F7] transition-colors">
                          <RotateCcw className="h-3 w-3" />移除</button>
                      )}
                    </div>
                  </div>
                  {/* Inline review panel */}
                  {expandedId === record.id && record.status === "success" && record.result && (
                    <ReviewPanel
                      record={record}
                      onClose={() => setExpandedId(null)}
                      onImported={() => { fetchStats(); updateRecords(prev => prev.filter(r => r.id !== record.id)) }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-[#637089] uppercase tracking-wide mb-4">快捷操作</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 xl:gap-6">
            {QUICK_ACTIONS.map((action) => (
              <button key={action.label} onClick={() => navigate(action.path)}
                className="group bg-white rounded-xl border border-[#E6EAF2] p-5 text-left hover:shadow-md hover:border-[#2F6BFF]/30 transition-all">
                <div className="w-10 h-10 rounded-lg bg-[#DEE8FF] flex items-center justify-center mb-3 group-hover:bg-[#2F6BFF] transition-colors">
                  <action.icon className="h-5 w-5 text-[#2F6BFF] group-hover:text-white transition-colors" /></div>
                <h3 className="font-semibold text-[#152033] mb-1 group-hover:text-[#2F6BFF] transition-colors">{action.label}</h3>
                <p className="text-xs text-[#637089]">{action.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Info grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 xl:gap-6">
          <div className="bg-white rounded-xl border border-[#E6EAF2] p-6">
            <h2 className="text-sm font-semibold text-[#637089] uppercase tracking-wide mb-4">部门与岗位</h2>
            <div className="space-y-4">
              <div>
                <div className="text-xs text-[#637089] mb-1.5">部门</div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#EDF0F7] rounded-md text-sm font-medium text-[#152033]">
                  <span className="w-2 h-2 rounded-full bg-[#2F6BFF]" />直销中心</div>
              </div>
              <div><div className="text-xs text-[#637089] mb-1.5">岗位</div>
                <div className="flex flex-wrap gap-2">
                  {POSITIONS.map(p => <span key={p} className="text-xs bg-[#EDF0F7] text-[#637089] rounded-md px-2.5 py-1">{p}</span>)}</div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-2 bg-white rounded-xl border border-[#E6EAF2] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#637089] uppercase tracking-wide">今日核心指标</h2>
              <button onClick={() => navigate("/statistics")} className="text-xs text-[#2F6BFF] hover:text-[#1a5ae0] font-medium flex items-center gap-1">查看详情 <ArrowRight className="h-3 w-3" /></button>
            </div>
            {loading && <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-2 border-[#E6EAF2] border-t-[#2F6BFF]" /></div>}
            {!loading && error && <div className="flex items-center justify-center h-32 text-sm text-[#637089]"><div className="text-center"><div className="text-[#E5484D] mb-1">{error}</div><button onClick={fetchStats} className="text-[#2F6BFF] hover:underline">点击重试</button></div></div>}
            {!loading && !error && metrics.length === 0 && <div className="flex items-center justify-center h-32 text-sm text-[#637089]">暂无数据</div>}
            {!loading && !error && metrics.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {metrics.map((m) => (
                  <div key={m.key} className="text-center p-3 rounded-lg hover:bg-[#F6F8FB] transition-colors">
                    <div className="text-2xl font-bold text-[#152033]">{m.today}</div>
                    <div className="text-xs text-[#637089] mt-1">{m.label}</div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      {m.change > 0 ? <TrendingUp className="h-3 w-3 text-[#16A37B]" /> : m.change < 0 ? <TrendingDown className="h-3 w-3 text-[#E5484D]" /> : <Minus className="h-3 w-3 text-[#637089]" />}
                      <span className={cn("text-xs font-medium", m.change > 0 ? "text-[#16A37B]" : m.change < 0 ? "text-[#E5484D]" : "text-[#637089]")}>{m.change > 0 ? "+" : ""}{m.change}</span>
                      <span className="text-xs text-[#637089] ml-0.5">({m.rate})</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
