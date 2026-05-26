import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import AppNav from "@/components/AppNav"
import {
  getDailyReports,
  createDailyReport,
  updateDailyReport,
  deleteDailyReport,
  getChannelCalls,
  getUsers,
} from "@/lib/api"
import type { DailyReport, UserInfo, ChannelCalls } from "@/types"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import { Plus, Copy, Trash2, FileSpreadsheet, RefreshCw } from "lucide-react"

// localStorage cache — survives page refresh, keyed per user
function getLSKey() { const u = getCurrentUser(); return `daily_cache_v3_${u?.username || "anon"}` }

// Module-level cache — survives page navigation (faster than localStorage parse)
let _cachedReports: DailyReport[] | null = null
let _cachedUsers: UserInfo[] | null = null
let _cachedKey = ""
let _cachedForUser = ""

type EditableField = keyof Pick<
  DailyReport,
  | "record_date"
  | "name"
  | "boss_chat"
  | "zhilian_chat"
  | "wuyou_chat"
  | "boss_resume"
  | "zhilian_resume"
  | "wuyou_resume"
  | "other_resume"
  | "boss_call"
  | "zhilian_call"
  | "wuyou_call"
  | "moka_call"
  | "other_call"
  | "moka_process"
  | "boss_vip"
  | "zhilian_vip"
  | "wuyou_vip"
  | "remarks"
>

const NUMERIC_FIELDS: ReadonlySet<EditableField> = new Set([
  "boss_chat",
  "zhilian_chat",
  "wuyou_chat",
  "boss_resume",
  "zhilian_resume",
  "wuyou_resume",
  "other_resume",
  "boss_call",
  "zhilian_call",
  "wuyou_call",
  "moka_call",
  "other_call",
  "moka_process",
])

interface ColumnDef {
  key: EditableField
  label: string
}

interface GroupDef {
  title: string
  columns: ColumnDef[]
}

const GROUP_HEADERS: GroupDef[] = [
  {
    title: "基础信息",
    columns: [
      { key: "record_date", label: "日期" },
      { key: "name", label: "姓名" },
    ],
  },
  {
    title: "开聊数",
    columns: [
      { key: "boss_chat", label: "Boss" },
      { key: "zhilian_chat", label: "智联" },
      { key: "wuyou_chat", label: "前程无忧" },
    ],
  },
  {
    title: "获取简历数",
    columns: [
      { key: "boss_resume", label: "Boss" },
      { key: "zhilian_resume", label: "智联" },
      { key: "wuyou_resume", label: "前程无忧" },
      { key: "other_resume", label: "其他" },
    ],
  },
  {
    title: "电话沟通数(不含未接通)",
    columns: [
      { key: "boss_call", label: "Boss" },
      { key: "zhilian_call", label: "智联" },
      { key: "wuyou_call", label: "前程无忧" },
      { key: "moka_call", label: "Moka" },
      { key: "other_call", label: "其他" },
    ],
  },
  {
    title: "Moka",
    columns: [{ key: "moka_process", label: "简历处理数" }],
  },
  {
    title: "VIP账号权益使用",
    columns: [
      { key: "boss_vip", label: "Boss" },
      { key: "zhilian_vip", label: "智联" },
      { key: "wuyou_vip", label: "前程无忧" },
    ],
  },
  {
    title: "备注",
    columns: [{ key: "remarks", label: "特殊情况备注" }],
  },
]

const ALL_COLUMNS: ColumnDef[] = GROUP_HEADERS.flatMap((g) => g.columns)

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}/${m}/${day}`
}

// Internal data format (YYYY-MM-DD, for API/DB)
function dataDateStr(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function todayStr(): string {
  return dataDateStr()
}

function getDefaultReport(): Partial<DailyReport> {
  const user = getCurrentUser()
  return {
    record_date: todayStr(),
    name: user?.display_name || "",
    boss_chat: 0,
    zhilian_chat: 0,
    wuyou_chat: 0,
    boss_resume: 0,
    zhilian_resume: 0,
    wuyou_resume: 0,
    other_resume: 0,
    boss_call: 0,
    zhilian_call: 0,
    wuyou_call: 0,
    moka_call: 0,
    other_call: 0,
    moka_process: 0,
    boss_vip: "",
    zhilian_vip: "",
    wuyou_vip: "",
    remarks: "",
  }
}

function getCellValue(report: DailyReport, field: EditableField): string {
  const v = report[field]
  if (v === null || v === undefined) return ""
  return String(v)
}

function getRowText(report: DailyReport): string {
  const parts = [String(report.id), ...ALL_COLUMNS.map((col) => {
    const v = getCellValue(report, col.key)
    return col.key === "record_date" ? v.replace(/-/g, "/") : v
  })]
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

export default function DailyReportPage() {
  const currentUser = getCurrentUser()
  const isAdmin = currentUser?.role === "admin"

  const [reports, setReports] = useState<DailyReport[]>(() => {
    const curUser = getCurrentUser()?.username || ""
    if (_cachedReports && _cachedForUser === curUser) return _cachedReports
    // Cache is stale (different user) — clear it
    _cachedReports = null; _cachedUsers = null; _cachedKey = ""; _cachedForUser = ""
    try {
      const raw = localStorage.getItem(getLSKey())
      if (raw) {
        const p = JSON.parse(raw)
        _cachedReports = p.reports || []
        _cachedUsers = p.users || []
        _cachedKey = p.key || ""
        _cachedForUser = getCurrentUser()?.username || ""
        return _cachedReports
      }
    } catch {}
    return []
  })
  const [users, setUsers] = useState<UserInfo[]>(() => _cachedUsers ?? [])
  const [loading, setLoading] = useState(() => _cachedReports === null)
  const [selectedName, setSelectedName] = useState<string>("")
  const [editingCell, setEditingCell] = useState<{
    id: number
    field: EditableField
  } | null>(null)
  const [editValue, setEditValue] = useState("")
  const editInputRef = useRef<HTMLInputElement>(null)
  const mountedRef = useRef(false)

  const saveToStorage = (data: DailyReport[], userList: UserInfo[], key: string) => {
    _cachedReports = data
    _cachedUsers = userList
    _cachedKey = key
    _cachedForUser = getCurrentUser()?.username || ""
    try { localStorage.setItem(getLSKey(), JSON.stringify({ reports: data, users: userList, key })) } catch {}
  }

  // Detect user switch (different login on same browser) and clear all caches
  const lastUserRef = useRef(getCurrentUser()?.username || "")
  useEffect(() => {
    const cur = getCurrentUser()?.username || ""
    if (lastUserRef.current && lastUserRef.current !== cur) {
      _cachedReports = null; _cachedUsers = null; _cachedKey = ""; _cachedForUser = ""
      try { localStorage.removeItem(getLSKey()) } catch {}
      setReports([]); setUsers([]); setLoading(true)
    }
    lastUserRef.current = cur
  })

  const fetchData = useCallback(async () => {
    const curUser = getCurrentUser()?.username || ""
    if (mountedRef.current && _cachedReports && _cachedKey === selectedName && _cachedForUser === curUser) return
    if (!_cachedReports || _cachedForUser !== curUser) setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (selectedName) params.owner_id = selectedName
      const [data, userList] = await Promise.all([
        getDailyReports(params),
        getUsers(),
      ])
      saveToStorage(data, userList, selectedName)
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
    fetchData().then(() => { mountedRef.current = true })
  }, [fetchData])

  // Filter users for admin dropdown
  const adminFilterOptions = useMemo(() => {
    if (!isAdmin) return []
    const names = new Set(reports.map((r) => r.name).filter(Boolean))
    return Array.from(names) as string[]
  }, [isAdmin, reports])

  // Summary calculations
  const summary = useMemo(() => {
    let totalChat = 0
    let totalResume = 0
    let totalCall = 0
    let totalMoka = 0
    for (const r of reports) {
      totalChat += (r.boss_chat || 0) + (r.zhilian_chat || 0) + (r.wuyou_chat || 0)
      totalResume +=
        (r.boss_resume || 0) +
        (r.zhilian_resume || 0) +
        (r.wuyou_resume || 0) +
        (r.other_resume || 0)
      totalCall +=
        (r.boss_call || 0) +
        (r.zhilian_call || 0) +
        (r.wuyou_call || 0) +
        (r.moka_call || 0) +
        (r.other_call || 0)
      totalMoka += r.moka_process || 0
    }
    return { totalChat, totalResume, totalCall, totalMoka }
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
      await updateDailyReport(id, { [field]: value })
      setReports((prev) => {
        const updated = prev.map((r) =>
          r.id === id ? { ...r, [field]: value as never } : r
        )
        saveToStorage(updated, _cachedUsers ?? [], selectedName)
        return updated
      })
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
      const channelCalls: ChannelCalls = await getChannelCalls()
      const data = {
        ...getDefaultReport(),
        boss_call: channelCalls.boss_call,
        zhilian_call: channelCalls.zhilian_call,
        wuyou_call: channelCalls.wuyou_call,
        moka_call: channelCalls.moka_call,
        other_call: channelCalls.other_call,
      }
      const created = await createDailyReport(data)
      const updated = [...(_cachedReports ?? []), created]
      saveToStorage(updated, _cachedUsers ?? [], selectedName)
      setReports((prev) => [...prev, created])
      toast.success("已添加新行")
    } catch (err) {
      console.error(err)
      toast.error("添加失败")
    }
  }, [])

  // Copy row (TSV) for Excel paste
  const handleCopyRow = (report: DailyReport) => {
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

  // Refresh channel call stats for a row
  const handleRefreshRow = async (report: DailyReport) => {
    try {
      const channelCalls: ChannelCalls = await getChannelCalls({ date: report.record_date })
      const updated = await updateDailyReport(report.id, {
        boss_call: channelCalls.boss_call,
        zhilian_call: channelCalls.zhilian_call,
        wuyou_call: channelCalls.wuyou_call,
        moka_call: channelCalls.moka_call,
        other_call: channelCalls.other_call,
      })
      setReports((prev) => prev.map((r) => r.id === report.id ? { ...r, ...updated } : r))
      _cachedReports = null
      toast.success("已刷新")
    } catch (e) { console.error(e); toast.error("刷新失败") }
  }

  // Delete row
  const handleDeleteRow = useCallback(
    async (id: number) => {
      if (!window.confirm("确定要删除此行吗？")) return
      try {
        await deleteDailyReport(id)
        const updated = (_cachedReports ?? []).filter(r => r.id !== id)
        saveToStorage(updated, _cachedUsers ?? [], selectedName)
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
    const colRow: string[] = ALL_COLUMNS.map((c) => c.label)
    wsData.push(colRow)

    // Data rows
    for (const r of reports) {
      wsData.push(ALL_COLUMNS.map((col) => {
        const v = getCellValue(r, col.key)
        return col.key === "record_date" ? v.replace(/-/g, "/") : v
      }))
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

    XLSX.utils.book_append_sheet(wb, ws, "日报")
    const dateStr = formatDate(new Date())
    XLSX.writeFile(wb, `日报_${dateStr}.xlsx`)
    toast.success("导出成功")
  }, [reports])

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <AppNav />
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        {/* Top bar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-[#152033]">日报表</h1>
          <div className="flex flex-wrap items-center gap-2">
            {/* Admin filter */}
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
                {ALL_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-2 text-center text-xs font-medium border-r border-[#7aa6ff] last:border-r-0"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="sticky right-0 z-10 bg-[#5a8fff] px-3 py-2 text-center text-xs font-medium w-[100px]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={ALL_COLUMNS.length + 1}
                    className="px-3 py-12 text-center text-[#637089]"
                  >
                    加载中...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td
                    colSpan={ALL_COLUMNS.length + 1}
                    className="px-3 py-12 text-center text-[#637089]"
                  >
                    暂无数据
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr
                    key={report.id}
                    className="border-b border-[#E5E7EB] hover:bg-[#F8FAFC] transition-colors"
                  >
                    {ALL_COLUMNS.map((col) => {
                        const isEditing =
                          editingCell?.id === report.id &&
                          editingCell?.field === col.key
                        const value = getCellValue(report, col.key)
                        return (
                          <td
                            key={col.key}
                            className="px-3 py-2 text-center text-[#152033] border-r border-[#E5E7EB] last:border-r-0"
                            onDoubleClick={() =>
                              handleDoubleClick(report.id, col.key)
                            }
                          >
                            {isEditing ? (
                              <input
                                ref={editInputRef}
                                type={NUMERIC_FIELDS.has(col.key) ? "number" : "text"}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={handleEditKeyDown}
                                onBlur={handleEditSave}
                                className="w-full rounded border border-[#2F6BFF] px-2 py-1 text-center text-sm outline-none focus:ring-1 focus:ring-[#2F6BFF]"
                              />
                            ) : (
                              <span className="cursor-default px-1">
                                {col.key === "record_date" ? value.replace(/-/g, "/") : value}
                              </span>
                            )}
                          </td>
                        )
                      })}
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
                  ))
                )}
            </tbody>
          </table>
        </div>

        {/* Summary cards */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-white p-4 shadow-sm border border-[#E5E7EB]">
            <p className="text-xs text-[#637089]">总开聊数</p>
            <p className="mt-1 text-2xl font-bold text-[#2F6BFF]">
              {summary.totalChat}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm border border-[#E5E7EB]">
            <p className="text-xs text-[#637089]">总获取简历数</p>
            <p className="mt-1 text-2xl font-bold text-[#2F6BFF]">
              {summary.totalResume}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm border border-[#E5E7EB]">
            <p className="text-xs text-[#637089]">总电话沟通数</p>
            <p className="mt-1 text-2xl font-bold text-[#2F6BFF]">
              {summary.totalCall}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm border border-[#E5E7EB]">
            <p className="text-xs text-[#637089]">Moka简历处理数</p>
            <p className="mt-1 text-2xl font-bold text-[#2F6BFF]">
              {summary.totalMoka}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
