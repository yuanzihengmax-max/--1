import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import AppNav from "@/components/AppNav"
import {
  getWeeklyReports,
  createWeeklyReport,
  updateWeeklyReport,
  deleteWeeklyReport,
  getWeeklyChannelStats,
  getPipelineStats,
  getUsers,
} from "@/lib/api"
import type { WeeklyReport, UserInfo } from "@/types"

// localStorage cache — survives page refresh, keyed per user
function getWRLSKey() { const u = getCurrentUser(); return `weekly_cache_v3_${u?.username || "anon"}` }

// Module-level cache — survives page navigation
let _cachedWR: WeeklyReport[] | null = null
let _cachedWRUsers: UserInfo[] | null = null
let _wrCachedKey = ""
let _wrCachedForUser = ""
import * as XLSX from "xlsx"
import { toast } from "sonner"
import { Plus, Copy, Trash2, FileSpreadsheet, RefreshCw } from "lucide-react"

type EditableField = keyof Pick<
  WeeklyReport,
  | "week_range"
  | "name"
  | "boss_contact"
  | "zhilian_contact"
  | "wuyou_contact"
  | "moka_contact"
  | "boss_refer"
  | "zhilian_refer"
  | "wuyou_refer"
  | "moka_refer"
  | "first_interview_invite"
  | "first_interview_show"
  | "first_interview_pass"
  | "second_interview_invite"
  | "second_interview_show"
  | "second_interview_pass"
  | "summary_1"
  | "summary_2"
  | "summary_3"
  | "summary_4"
  | "attendance_date"
  | "attendance_time"
  | "attendance_reason"
>

const NUMERIC_FIELDS: ReadonlySet<EditableField> = new Set([
  "boss_contact",
  "zhilian_contact",
  "wuyou_contact",
  "moka_contact",
  "boss_refer",
  "zhilian_refer",
  "wuyou_refer",
  "moka_refer",
  "first_interview_invite",
  "first_interview_show",
  "first_interview_pass",
  "second_interview_invite",
  "second_interview_show",
  "second_interview_pass",
])

interface ColumnDef {
  key: EditableField
  label: string
}

interface RateColumnDef {
  label: string
  calc: (r: WeeklyReport) => string
}

interface GroupDef {
  title: string
  columns: (ColumnDef | RateColumnDef)[]
  isRateGroup?: boolean
}

function getCurrentWeekRange(): string {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)

  const fmt = (d: Date): string => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${y}/${m}/${dd}`
  }
  return `${fmt(monday)}-${fmt(friday)}`
}

const GROUP_HEADERS: GroupDef[] = [
  {
    title: "基础信息",
    columns: [
      { key: "week_range", label: "周次" },
      { key: "name", label: "姓名" },
    ],
  },
  {
    title: "各渠道沟通量",
    columns: [
      { key: "boss_contact", label: "Boss" },
      { key: "zhilian_contact", label: "智联" },
      { key: "wuyou_contact", label: "前程无忧" },
      { key: "moka_contact", label: "Moka" },
    ],
  },
  {
    title: "各渠道推荐量",
    columns: [
      { key: "boss_refer", label: "Boss" },
      { key: "zhilian_refer", label: "智联" },
      { key: "wuyou_refer", label: "前程无忧" },
      { key: "moka_refer", label: "Moka" },
    ],
  },
  {
    title: "初试情况",
    columns: [
      { key: "first_interview_invite", label: "邀约数" },
      { key: "first_interview_show", label: "到面数" },
      { key: "first_interview_pass", label: "通过数" },
    ],
  },
  {
    title: "复试情况",
    columns: [
      { key: "second_interview_invite", label: "邀约数" },
      { key: "second_interview_show", label: "到面数" },
      { key: "second_interview_pass", label: "通过数" },
    ],
  },
  {
    title: "面试率",
    isRateGroup: true,
    columns: [
      {
        label: "初试到面率",
        calc: (r: WeeklyReport) => {
          if (!r.first_interview_invite) return "-"
          const rate = ((r.first_interview_show || 0) / r.first_interview_invite) * 100
          return `${rate.toFixed(1)}%`
        },
      },
      {
        label: "初试通过率",
        calc: (r: WeeklyReport) => {
          if (!r.first_interview_show) return "-"
          const rate = ((r.first_interview_pass || 0) / r.first_interview_show) * 100
          return `${rate.toFixed(1)}%`
        },
      },
      {
        label: "复试到面率",
        calc: (r: WeeklyReport) => {
          if (!r.second_interview_invite) return "-"
          const rate = ((r.second_interview_show || 0) / r.second_interview_invite) * 100
          return `${rate.toFixed(1)}%`
        },
      },
      {
        label: "复试通过率",
        calc: (r: WeeklyReport) => {
          if (!r.second_interview_show) return "-"
          const rate = ((r.second_interview_pass || 0) / r.second_interview_show) * 100
          return `${rate.toFixed(1)}%`
        },
      },
    ],
  },
  {
    title: "周总结",
    columns: [
      { key: "summary_1", label: "周总结" },
    ],
  },
  {
    title: "考勤",
    columns: [
      { key: "attendance_date", label: "考勤情况" },
    ],
  },
]

function isColumnDef(c: ColumnDef | RateColumnDef): c is ColumnDef {
  return "key" in c
}

function isRateColumnDef(c: ColumnDef | RateColumnDef): c is RateColumnDef {
  return "calc" in c
}

function getDefaultReport(): Partial<WeeklyReport> {
  const user = getCurrentUser()
  return {
    week_range: getCurrentWeekRange(),
    name: user?.display_name || "",
    boss_contact: 0,
    zhilian_contact: 0,
    wuyou_contact: 0,
    moka_contact: 0,
    boss_refer: 0,
    zhilian_refer: 0,
    wuyou_refer: 0,
    moka_refer: 0,
    first_interview_invite: 0,
    first_interview_show: 0,
    first_interview_pass: 0,
    second_interview_invite: 0,
    second_interview_show: 0,
    second_interview_pass: 0,
    summary_1: "",
    summary_2: "",
    summary_3: "",
    summary_4: "",
    attendance_date: "",
    attendance_time: "",
    attendance_reason: "",
  }
}

function getCellValue(report: WeeklyReport, field: EditableField): string {
  if (field === "summary_1") {
    const parts = [report.summary_1, report.summary_2, report.summary_3, report.summary_4].filter(Boolean)
    return parts.join("\n")
  }
  if (field === "attendance_date") {
    const parts = [report.attendance_date, report.attendance_time, report.attendance_reason].filter(Boolean)
    return parts.join("\n")
  }
  const v = report[field]
  if (v === null || v === undefined) return ""
  return String(v)
}

function getRowText(report: WeeklyReport): string {
  const parts: string[] = []
  for (const group of GROUP_HEADERS) {
    for (const col of group.columns) {
      if (isColumnDef(col)) {
        if (col.key === "week_range") continue
        parts.push(getCellValue(report, col.key))
      } else {
        // Rate: output raw decimal, not formatted string
        const label = col.label
        if (label === "初试到面率") {
          const v = (report.first_interview_show || 0) / (report.first_interview_invite || 1)
          parts.push(report.first_interview_invite ? String(v) : "")
        } else if (label === "初试通过率") {
          const v = (report.first_interview_pass || 0) / (report.first_interview_show || 1)
          parts.push(report.first_interview_show ? String(v) : "")
        } else if (label === "复试到面率") {
          const v = (report.second_interview_show || 0) / (report.second_interview_invite || 1)
          parts.push(report.second_interview_invite ? String(v) : "")
        } else if (label === "复试通过率") {
          const v = (report.second_interview_pass || 0) / (report.second_interview_show || 1)
          parts.push(report.second_interview_show ? String(v) : "")
        }
      }
    }
  }
  return parts.join("\t")
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem("auth-storage-v2")
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed.state?.user || null
  } catch {
    return null
  }
}

export default function WeeklyReportPage() {
  const currentUser = getCurrentUser()
  const isAdmin = currentUser?.role === "admin"

  const [reports, setReports] = useState<WeeklyReport[]>(() => {
    const curUser = getCurrentUser()?.username || ""
    if (_cachedWR && _wrCachedForUser === curUser) return _cachedWR as WeeklyReport[]
    _cachedWR = null; _cachedWRUsers = null; _wrCachedKey = ""; _wrCachedForUser = ""
    try {
      const raw = localStorage.getItem(getWRLSKey())
      if (raw) {
        const p = JSON.parse(raw)
        _cachedWR = p.reports || []
        _cachedWRUsers = p.users || []
        _wrCachedKey = p.key || ""
        _wrCachedForUser = getCurrentUser()?.username || ""
        return _cachedWR
      }
    } catch {}
    return []
  })
  const [users, setUsers] = useState<UserInfo[]>(() => _cachedWRUsers ?? [])
  const [loading, setLoading] = useState(() => _cachedWR === null)
  const [selectedName, setSelectedName] = useState<string>("")
  const [editingCell, setEditingCell] = useState<{
    id: number
    field: EditableField
  } | null>(null)
  const [editValue, setEditValue] = useState("")
  const editInputRef = useRef<HTMLInputElement>(null)
  const wrMounted = useRef(false)

  const saveWRToStorage = (data: WeeklyReport[], userList: UserInfo[], key: string) => {
    _cachedWR = data
    _cachedWRUsers = userList
    _wrCachedKey = key
    _wrCachedForUser = getCurrentUser()?.username || ""
    try { localStorage.setItem(getWRLSKey(), JSON.stringify({ reports: data, users: userList, key })) } catch {}
  }

  // Detect user switch and clear all caches
  const lastWRUserRef = useRef(getCurrentUser()?.username || "")
  useEffect(() => {
    const cur = getCurrentUser()?.username || ""
    if (lastWRUserRef.current && lastWRUserRef.current !== cur) {
      _cachedWR = null; _cachedWRUsers = null; _wrCachedKey = ""; _wrCachedForUser = ""
      try { localStorage.removeItem(getWRLSKey()) } catch {}
      setReports([]); setUsers([]); setLoading(true)
    }
    lastWRUserRef.current = cur
  })

  const fetchData = useCallback(async () => {
    const curUser = getCurrentUser()?.username || ""
    if (wrMounted.current && _cachedWR && _wrCachedKey === selectedName && _wrCachedForUser === curUser) return
    if (!_cachedWR || _wrCachedForUser !== curUser) setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (selectedName) params.owner_id = selectedName
      const [data, userList] = await Promise.all([
        getWeeklyReports(params),
        getUsers(),
      ])
      saveWRToStorage(data, userList, selectedName)
      setReports(data)
      setUsers(userList)
    } catch (err) {
      console.error(err)
      toast.error("获取数据失败")
    } finally {
      setLoading(false)
    }
  }, [selectedName])

  useEffect(() => {
    fetchData().then(() => { wrMounted.current = true })
  }, [fetchData])

  // Filter users for admin dropdown
  const adminFilterOptions = useMemo(() => {
    if (!isAdmin) return []
    const names = new Set(reports.map((r) => r.name).filter(Boolean))
    return Array.from(names) as string[]
  }, [isAdmin, reports])

  // Summary calculations
  const summary = useMemo(() => {
    let totalContact = 0
    let totalRefer = 0
    let totalFirstInvite = 0
    let totalFirstShow = 0
    let totalFirstPass = 0
    let totalSecondInvite = 0
    let totalSecondShow = 0
    let totalSecondPass = 0

    for (const r of reports) {
      totalContact +=
        (r.boss_contact || 0) +
        (r.zhilian_contact || 0) +
        (r.wuyou_contact || 0) +
        (r.moka_contact || 0)
      totalRefer +=
        (r.boss_refer || 0) +
        (r.zhilian_refer || 0) +
        (r.wuyou_refer || 0) +
        (r.moka_refer || 0)
      totalFirstInvite += r.first_interview_invite || 0
      totalFirstShow += r.first_interview_show || 0
      totalFirstPass += r.first_interview_pass || 0
      totalSecondInvite += r.second_interview_invite || 0
      totalSecondShow += r.second_interview_show || 0
      totalSecondPass += r.second_interview_pass || 0
    }

    const firstShowRate =
      totalFirstInvite > 0
        ? `${((totalFirstShow / totalFirstInvite) * 100).toFixed(1)}%`
        : "-"
    const secondPassRate =
      totalSecondShow > 0
        ? `${((totalSecondPass / totalSecondShow) * 100).toFixed(1)}%`
        : "-"

    return {
      totalContact,
      totalRefer,
      firstShowRate,
      secondPassRate,
    }
  }, [reports])

  // Inline editing
  const handleDoubleClick = useCallback(
    (id: number, field: EditableField) => {
      const report = reports.find((r) => r.id === id)
      if (!report) return
      setEditingCell({ id, field })
      setEditValue(getCellValue(report, field))
      setTimeout(() => {
        editInputRef.current?.focus()
        editInputRef.current?.select()
      }, 0)
    },
    [reports]
  )

  const handleEditSave = useCallback(async () => {
    if (!editingCell) return
    const { id, field } = editingCell
    let value: string | number = editValue
    if (NUMERIC_FIELDS.has(field)) {
      const num = parseInt(editValue, 10)
      value = isNaN(num) ? 0 : num
    }
    try {
      // Handle merged fields
      if (field === "summary_1") {
        const lines = String(editValue).split("\n")
        await updateWeeklyReport(id, {
          summary_1: lines[0] || "",
          summary_2: lines[1] || "",
          summary_3: lines[2] || "",
          summary_4: lines.slice(3).join("\n") || "",
        } as any)
        setReports((prev) => {
          const updated = prev.map((r) => r.id === id ? {
            ...r,
            summary_1: lines[0] || "",
            summary_2: lines[1] || "",
            summary_3: lines[2] || "",
            summary_4: lines.slice(3).join("\n") || "",
          } as WeeklyReport : r)
          saveWRToStorage(updated, _cachedWRUsers ?? [], selectedName)
          return updated
        })
      } else if (field === "attendance_date") {
        const lines = String(editValue).split("\n")
        await updateWeeklyReport(id, {
          attendance_date: lines[0] || "",
          attendance_time: lines[1] || "",
          attendance_reason: lines.slice(2).join("\n") || "",
        } as any)
        setReports((prev) => {
          const updated = prev.map((r) => r.id === id ? {
            ...r,
            attendance_date: lines[0] || "",
            attendance_time: lines[1] || "",
            attendance_reason: lines.slice(2).join("\n") || "",
          } as WeeklyReport : r)
          saveWRToStorage(updated, _cachedWRUsers ?? [], selectedName)
          return updated
        })
      } else {
        await updateWeeklyReport(id, { [field]: value as never })
        setReports((prev) => {
          const updated = prev.map((r) =>
            r.id === id ? { ...r, [field]: value as never } : r
          )
          saveWRToStorage(updated, _cachedWRUsers ?? [], selectedName)
          return updated
        })
      }
      toast.success("已保存")
    } catch (err) {
      console.error(err)
      toast.error("保存失败")
    } finally {
      setEditingCell(null)
      setEditValue("")
    }
  }, [editingCell, editValue])

  const handleEditCancel = useCallback(() => {
    setEditingCell(null)
    setEditValue("")
  }, [])

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleEditSave()
      } else if (e.key === "Escape") {
        handleEditCancel()
      }
    },
    [handleEditSave, handleEditCancel]
  )

  // Add row
  const handleAddRow = useCallback(async () => {
    try {
      const base = getDefaultReport()
      // Auto-fill channel stats from candidates table
      const weekRange = base.week_range || getCurrentWeekRange()
      const [start, end] = weekRange.split("-")
      const fmtDate = (s: string) => s.replace(/\//g, "-")
      try {
        const stats = await getWeeklyChannelStats(fmtDate(start), fmtDate(end))
        base.boss_contact = stats.contact.boss
        base.zhilian_contact = stats.contact.zhilian
        base.wuyou_contact = stats.contact.wuyou
        base.moka_contact = stats.contact.moka
        base.boss_refer = stats.refer.boss
        base.zhilian_refer = stats.refer.zhilian
        base.wuyou_refer = stats.refer.wuyou
        base.moka_refer = stats.refer.moka
      } catch { /* ignore */ }
      // Auto-fill pipeline stats from candidates table
      try {
        const pipe = await getPipelineStats(fmtDate(start), fmtDate(end))
        base.first_interview_invite = pipe.dept_eval_passed || 0
        base.first_interview_show = pipe.first_interview_show || 0
        base.first_interview_pass = pipe.interview_invited || 0
        base.second_interview_invite = pipe.second_interview || 0
        base.second_interview_show = pipe.second_interview_show || 0
        base.second_interview_pass = pipe.offer_sent || 0
      } catch { /* ignore */ }
      const created = await createWeeklyReport(base)
      const wUpdated = [...(_cachedWR ?? []), created]
      saveWRToStorage(wUpdated, _cachedWRUsers ?? [], selectedName)
      setReports((prev) => [...prev, created])
      toast.success("已添加新行")
    } catch (err) {
      console.error(err)
      toast.error("添加失败")
    }
  }, [])

  // Refresh pipeline stats for an existing row
  const handleRefreshRow = async (report: WeeklyReport) => {
    if (!report.week_range) return
    const [start, end] = report.week_range.split("-")
    const fmtDate = (s: string) => s.replace(/\//g, "-")
    try {
      const pipe = await getPipelineStats(fmtDate(start), fmtDate(end))
      const ch = await getWeeklyChannelStats(fmtDate(start), fmtDate(end))
      await updateWeeklyReport(report.id, {
        first_interview_invite: pipe.dept_eval_passed || 0,
        first_interview_show: pipe.first_interview_show || 0,
        first_interview_pass: pipe.interview_invited || 0,
        second_interview_invite: pipe.second_interview || 0,
        second_interview_show: pipe.second_interview_show || 0,
        second_interview_pass: pipe.offer_sent || 0,
        boss_contact: ch.contact.boss, zhilian_contact: ch.contact.zhilian,
        wuyou_contact: ch.contact.wuyou, moka_contact: ch.contact.moka,
        boss_refer: ch.refer.boss, zhilian_refer: ch.refer.zhilian,
        wuyou_refer: ch.refer.wuyou, moka_refer: ch.refer.moka,
      } as any)
      _cachedWR = null
      setReports((prev) => prev.map((r) => r.id === report.id ? { ...r,
        first_interview_invite: pipe.dept_eval_passed || 0,
        first_interview_show: pipe.first_interview_show || 0,
        first_interview_pass: pipe.interview_invited || 0,
        second_interview_invite: pipe.second_interview || 0,
        second_interview_show: pipe.second_interview_show || 0,
        second_interview_pass: pipe.offer_sent || 0,
        boss_contact: ch.contact.boss, zhilian_contact: ch.contact.zhilian,
        wuyou_contact: ch.contact.wuyou, moka_contact: ch.contact.moka,
        boss_refer: ch.refer.boss, zhilian_refer: ch.refer.zhilian,
        wuyou_refer: ch.refer.wuyou, moka_refer: ch.refer.moka,
      } as WeeklyReport : r))
      toast.success("已刷新")
    } catch (e) { console.error(e); toast.error("刷新失败") }
  }

  // Copy row (TSV) for Excel paste
  const handleCopyRow = (report: WeeklyReport) => {
    const text = getRowText(report)
    const ta = document.createElement("textarea")
    ta.value = text
    ta.style.position = "fixed"
    ta.style.left = "-9999px"
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    try {
      document.execCommand("copy")
      toast.success("已复制到剪贴板")
    } catch {
      toast.error("复制失败")
    }
    document.body.removeChild(ta)
  }

  // Delete row
  const handleDeleteRow = useCallback(
    async (id: number) => {
      if (!window.confirm("确定要删除此行吗？")) return
      try {
        await deleteWeeklyReport(id)
        const wUpdated = (_cachedWR ?? []).filter(r => r.id !== id)
        saveWRToStorage(wUpdated, _cachedWRUsers ?? [], selectedName)
        setReports((prev) => prev.filter((r) => r.id !== id))
        toast.success("已删除")
      } catch (err) {
        console.error(err)
        toast.error("删除失败")
      }
    },
    []
  )

  // Export XLSX
  const handleExportXLSX = useCallback(() => {
    const wsData: string[][] = []

    // Header row 1 - group headers
    const groupRow: string[] = []
    for (const group of GROUP_HEADERS) {
      groupRow.push(group.title)
      for (let i = 1; i < group.columns.length; i++) {
        groupRow.push("")
      }
    }
    wsData.push(groupRow)

    // Header row 2 - column labels
    const colRow: string[] = []
    for (const group of GROUP_HEADERS) {
      for (const col of group.columns) {
        colRow.push(col.label)
      }
    }
    wsData.push(colRow)

    // Data rows
    for (const r of reports) {
      const row: string[] = []
      for (const group of GROUP_HEADERS) {
        for (const col of group.columns) {
          if (isColumnDef(col)) {
            row.push(getCellValue(r, col.key))
          } else {
            row.push(col.calc(r))
          }
        }
      }
      wsData.push(row)
    }

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Merge group header cells
    const merges: XLSX.Range[] = []
    let colIdx = 0
    for (const group of GROUP_HEADERS) {
      if (group.columns.length > 1) {
        merges.push({
          s: { r: 0, c: colIdx },
          e: { r: 0, c: colIdx + group.columns.length - 1 },
        })
      }
      colIdx += group.columns.length
    }
    ws["!merges"] = merges

    XLSX.utils.book_append_sheet(wb, ws, "周报")
    const d = new Date()
    const dateStr = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`
    XLSX.writeFile(wb, `周报_${dateStr}.xlsx`)
    toast.success("导出成功")
  }, [reports])

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <AppNav />
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        {/* Top bar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-[#152033]">周报表</h1>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && adminFilterOptions.length > 0 && (
              <select
                value={selectedName}
                onChange={(e) => setSelectedName(e.target.value)}
                className="h-9 rounded-md border border-[#C8CDD8] bg-white px-3 text-sm text-[#152033] outline-none focus:ring-2 focus:ring-[#2F6BFF]"
              >
                <option value="">全部填写人</option>
                {adminFilterOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={handleAddRow}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#2F6BFF] px-4 text-sm font-medium text-white hover:bg-[#1a5ae0]"
            >
              <Plus className="h-4 w-4" />
              新增
            </button>
            <button
              onClick={handleExportXLSX}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#C8CDD8] bg-white px-4 text-sm font-medium text-[#152033] hover:bg-gray-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              导出Excel
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-[#E5E7EB] bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              {/* Group header row */}
              <tr className="bg-[#2F6BFF] text-white">
                {GROUP_HEADERS.map((group) => (
                  <th
                    key={group.title}
                    colSpan={group.columns.length}
                    className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider border-r border-[#5a8fff] last:border-r-0"
                  >
                    {group.title}
                  </th>
                ))}
                <th className="sticky right-0 z-10 bg-[#2F6BFF] px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider w-[100px]">
                  操作
                </th>
              </tr>
              {/* Column header row */}
              <tr className="bg-[#5a8fff] text-white">
                {GROUP_HEADERS.map((group) =>
                  group.columns.map((col) => (
                    <th
                      key={col.label}
                      className="px-3 py-2 text-center text-xs font-medium border-r border-[#7aa6ff] last:border-r-0"
                    >
                      {col.label}
                    </th>
                  ))
                )}
                <th className="sticky right-0 z-10 bg-[#5a8fff] px-3 py-2 text-center text-xs font-medium w-[100px]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={
                      GROUP_HEADERS.reduce((s, g) => s + g.columns.length, 0) +
                      1
                    }
                    className="px-3 py-12 text-center text-[#637089]"
                  >
                    加载中...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      GROUP_HEADERS.reduce((s, g) => s + g.columns.length, 0) +
                      1
                    }
                    className="px-3 py-12 text-center text-[#637089]"
                  >
                    暂无数据
                  </td>
                </tr>
              ) : (
                reports.map((report, idx) => {
                  return (
                    <tr
                      key={report.id}
                      className="border-b border-[#E5E7EB] hover:bg-[#F8FAFC] transition-colors"
                    >
                      {GROUP_HEADERS.map((group) =>
                        group.columns.map((col) => {
                          // Rate columns - read only
                          if (isRateColumnDef(col)) {
                            return (
                              <td
                                key={col.label}
                                className="px-3 py-2 text-center text-[#152033] bg-gray-50/80 border-r border-[#E5E7EB]"
                              >
                                <span className="text-[#637089]">
                                  {col.calc(report)}
                                </span>
                              </td>
                            )
                          }

                          // Editable columns
                          const dataCol = col as ColumnDef
                          const isEditing =
                            editingCell?.id === report.id &&
                            editingCell?.field === dataCol.key
                          const value = getCellValue(report, dataCol.key)
                          return (
                            <td
                              key={dataCol.key}
                              className="px-3 py-2 text-center text-[#152033] border-r border-[#E5E7EB] last:border-r-0"
                              onDoubleClick={() =>
                                handleDoubleClick(report.id, dataCol.key)
                              }
                            >
                              {isEditing ? (
                                dataCol.key === "summary_1" || dataCol.key === "attendance_date" ? (
                                  <textarea
                                    ref={editInputRef as any}
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Escape") handleEditCancel() }}
                                    onBlur={handleEditSave}
                                    className="w-full rounded border border-[#2F6BFF] px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-[#2F6BFF] resize-y"
                                    rows={4}
                                  />
                                ) : (
                                  <input
                                    ref={editInputRef}
                                    type={
                                      NUMERIC_FIELDS.has(dataCol.key)
                                        ? "number"
                                        : "text"
                                    }
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={handleEditKeyDown}
                                    onBlur={handleEditSave}
                                    className="w-full rounded border border-[#2F6BFF] px-2 py-1 text-center text-sm outline-none focus:ring-1 focus:ring-[#2F6BFF]"
                                  />
                                )
                              ) : (
                                <span className="cursor-default px-1 whitespace-pre-wrap text-left">
                                  {value}
                                </span>
                              )}
                            </td>
                          )
                        })
                      )}
                      {/* Actions cell */}
                      <td className="sticky right-0 z-10 bg-white px-2 py-2 border-l border-[#E5E7EB]">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleRefreshRow(report)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-gray-100 text-[#637089] hover:text-[#2F6BFF]"
                            title="刷新数据"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleCopyRow(report)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-gray-100 text-[#637089] hover:text-[#16A37B]"
                            title="复制行(TSV)"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRow(report.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-gray-100 text-[#637089] hover:text-red-500"
                            title="删除"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Summary cards */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-white p-4 shadow-sm border border-[#E5E7EB]">
            <p className="text-xs text-[#637089]">总沟通量</p>
            <p className="mt-1 text-2xl font-bold text-[#2F6BFF]">
              {summary.totalContact}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm border border-[#E5E7EB]">
            <p className="text-xs text-[#637089]">总推荐量</p>
            <p className="mt-1 text-2xl font-bold text-[#2F6BFF]">
              {summary.totalRefer}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm border border-[#E5E7EB]">
            <p className="text-xs text-[#637089]">初试到面率</p>
            <p className="mt-1 text-2xl font-bold text-[#2F6BFF]">
              {summary.firstShowRate}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm border border-[#E5E7EB]">
            <p className="text-xs text-[#637089]">复试通过率</p>
            <p className="mt-1 text-2xl font-bold text-[#2F6BFF]">
              {summary.secondPassRate}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
