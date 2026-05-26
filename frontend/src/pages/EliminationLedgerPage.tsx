import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import AppNav from "@/components/AppNav"
import {
  getCandidates,
  updateCandidate,
  deleteCandidate,
  getUsers,
} from "@/lib/api"
import { cn } from "@/lib/utils"
import type { Candidate, UserInfo } from "@/types"
import * as XLSX from "xlsx"
import {
  Pencil,
  Save,
  X,
  Copy,
  Trash2,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  CheckCheck,
  AlertCircle,
  FileUp,
  ArrowRightLeft,
} from "lucide-react"

// ─── Constants ───────────────────────────────────────────────────────
const ELIMINATE_STATUSES = [
  "候选人不考虑",
  "评估后不符合要求",
  "不接电话",
  "沟通后淘汰",
  "其他",
]

// ─── Column definitions ──────────────────────────────────────────────
interface ColumnDef {
  key: keyof Candidate | "index"
  label: string
  width?: string
  editable?: boolean
}

const CHANNEL_OPTIONS = ["BOSS","智联","前程无忧","猎聘","新媒体（小红书、抖音等）","内推","校招线下双选会","实习僧","其他"]

const COLUMNS: ColumnDef[] = [
  { key: "index", label: "序号", width: "w-14" },
  { key: "intern_name", label: "实习生", editable: true },
  { key: "communicate_time", label: "沟通时间", editable: true },
  { key: "name", label: "姓名", editable: true },
  { key: "phone", label: "手机号", editable: true },
  { key: "email", label: "邮箱", editable: true },
  { key: "gender", label: "性别", editable: true },
  { key: "birth_year", label: "出生年", editable: true },
  { key: "school", label: "学校", editable: true },
  { key: "major", label: "专业", editable: true },
  { key: "education", label: "学历", editable: true },
  { key: "is_fresh_grad", label: "是否是应届生", editable: true },
  { key: "channel", label: "招聘渠道", editable: true },
  { key: "eliminate_status", label: "沟通状态", editable: true },
  { key: "eliminate_detail", label: "沟通详情", editable: true },
]

// ─── Helpers ─────────────────────────────────────────────────────────
function getUser() {
  try {
    const raw = localStorage.getItem("auth-storage-v2")
    if (!raw) return null
    return JSON.parse(raw).state?.user ?? null
  } catch {
    return null
  }
}

function getCellValue(row: Candidate, key: string): unknown {
  if (key === "index") return undefined
  return (row as Record<string, unknown>)[key]
}

function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return ""
  return String(val)
}

// ─── Component ───────────────────────────────────────────────────────
export default function EliminationLedgerPage() {
  const navigate = useNavigate()
  const user = getUser()
  const isAdmin = user?.role === "admin"

  // Data state
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchName, setSearchName] = useState("")
  const [users, setUsers] = useState<UserInfo[]>([])
  const [filterUser, setFilterUser] = useState("")
  const [dateStart, setDateStart] = useState("")
  const [dateEnd, setDateEnd] = useState("")

  // Editing
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Partial<Candidate>>({})

  // Notifications
  const [toast, setToast] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const showToast = useCallback(
    (type: "success" | "error", message: string) => {
      setToast({ type, message })
      setTimeout(() => setToast(null), 3000)
    },
    [],
  )

  // Fetch users (admin only)
  useEffect(() => {
    if (!isAdmin) return
    getUsers()
      .then(setUsers)
      .catch(() => {})
  }, [isAdmin])

  // Fetch candidates
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string | number> = {
        result: "淘汰",
        page,
        page_size: pageSize,
      }
      if (searchName.trim()) params.name = searchName.trim()
      if (filterUser) params.intern_name = filterUser
      if (dateStart) params.date_start = dateStart
      if (dateEnd) params.date_end = dateEnd
      const data = await getCandidates(params)
      setCandidates(data.items)
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail || err?.message || "获取数据失败"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchName, filterUser, dateStart, dateEnd])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Start editing a row
  const startEdit = (c: Candidate) => {
    setEditingId(c.id)
    setEditForm({
      intern_name: c.intern_name ?? "",
      communicate_time: c.communicate_time ?? "",
      name: c.name ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      gender: c.gender ?? "",
      birth_year: c.birth_year ?? undefined,
      school: c.school ?? "",
      major: c.major ?? "",
      education: c.education ?? "",
      is_fresh_grad: c.is_fresh_grad ?? "",
      channel: c.channel ?? "",
      eliminate_status: c.eliminate_status ?? "",
      eliminate_detail: c.eliminate_detail ?? "",
    })
  }

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  // Save editing
  const saveEdit = async () => {
    if (!editingId) return
    try {
      await updateCandidate(editingId, editForm)
      showToast("success", "更新成功")
      setEditingId(null)
      setEditForm({})
      fetchData()
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail || err?.message || "更新失败"
      showToast("error", msg)
    }
  }

  // Handle inline field change
  const handleFieldChange = (key: string, val: unknown) => {
    setEditForm((prev) => ({ ...prev, [key]: val }))
  }

  // Move candidate to recommendation
  const handleMoveToRecommendation = async (id: number, iname: string) => {
    if (!confirm("确定将该候选人转入推荐台账吗？")) return
    try {
      await updateCandidate(id, { result: "推荐" }, iname)
      setCandidates((prev) => prev.filter((c) => !(c.id === id && c.intern_name === iname)))
      setTotal((prev) => prev - 1)
      showToast("success", "已转入推荐台账")
    } catch (err: any) {
      showToast("error", err?.response?.data?.detail || "操作失败")
    }
  }

  // Delete candidate
  const handleDeleteCandidate = async (id: number, iname: string) => {
    if (!confirm("确定要删除该候选人吗？此操作不可撤销。")) return
    try {
      await deleteCandidate(id, iname)
      setCandidates((prev) => prev.filter((c) => !(c.id === id && c.intern_name === iname)))
      setTotal((prev) => prev - 1)
      showToast("success", "已删除")
    } catch (err: any) {
      showToast("error", err?.response?.data?.detail || "删除失败")
    }
  }

  // Copy row as TSV
  const copyRow = (row: Candidate, idx: number) => {
    const values = COLUMNS.map((col) => {
      if (col.key === "index") return String(idx)
      const raw = formatCellValue(getCellValue(row, col.key as string))
      return col.key === "communicate_time" ? raw.replace(/-/g, "/") : raw
    })
    const tsv = values.join("\t")
    const ta = document.createElement("textarea")
    ta.value = tsv
    ta.style.position = "fixed"; ta.style.top = "0"; ta.style.left = "0"
    ta.style.opacity = "0"; ta.style.pointerEvents = "none"
    document.body.appendChild(ta)
    ta.focus(); ta.select()
    try {
      document.execCommand("copy")
      showToast("success", "已复制到剪贴板")
    } catch {
      showToast("error", "复制失败")
    }
    document.body.removeChild(ta)
  }

  // Export XLSX — fetch ALL data, include 序号
  const exportXLSX = async () => {
    try {
      let allCandidates: Candidate[] = []
      let p = 1
      while (true) {
        const params: Record<string, string | number> = { result: "淘汰", page: p, page_size: 200 }
        if (filterUser) params.intern_name = filterUser
        if (dateStart) params.date_start = dateStart
        if (dateEnd) params.date_end = dateEnd
        const data = await getCandidates(params)
        allCandidates = allCandidates.concat(data.items)
        if (p >= data.total_pages) break
        p++
      }
      const headers = COLUMNS.map((c) => c.key === "index" ? "序号" : c.label)
      const rows = allCandidates.map((row, idx) =>
        COLUMNS.map((col) => {
          if (col.key === "index") return String(idx + 1)
          const raw = formatCellValue(getCellValue(row, col.key as string))
          return col.key === "communicate_time" ? raw.replace(/-/g, "/") : raw
        }),
      )
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "淘汰台账")
      const d = new Date()
      const ds = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`
      XLSX.writeFile(wb, `淘汰台账_${ds}.xlsx`)
      showToast("success", `已导出 ${allCandidates.length} 条数据`)
    } catch (err: any) {
      showToast("error", "导出失败")
    }
  }

  // Pagination
  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return
    setPage(p)
  }

  const renderPagination = () => {
    if (totalPages <= 1) return null
    const pages: (number | "...")[] = []
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= page - 1 && i <= page + 1)
      ) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== "...") {
        pages.push("...")
      }
    }
    return (
      <div className="flex items-center justify-between mt-4 text-sm">
        <span className="text-[#637089]">
          共 {total} 条，第 {page}/{totalPages} 页
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="p-1.5 rounded hover:bg-[#EDF0F7] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`e${i}`} className="px-2 text-[#637089]">
                ...
              </span>
            ) : (
              <button
                key={p}
                onClick={() => goToPage(p)}
                className={cn(
                  "px-3 py-1 rounded text-sm font-medium transition-colors",
                  p === page
                    ? "bg-[#2F6BFF] text-white"
                    : "text-[#637089] hover:bg-[#EDF0F7]",
                )}
              >
                {p}
              </button>
            ),
          )}
          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="p-1.5 rounded hover:bg-[#EDF0F7] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <AppNav />
      <main className="max-w-[1600px] mx-auto px-4 xl:px-6 py-6 xl:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-[#152033]">淘汰台账</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2F6BFF] text-white rounded-md text-sm font-medium hover:bg-[#1a5ae0] transition-colors"
            >
              <FileUp className="h-4 w-4" />
              PDF导入
            </button>
            <button
              onClick={exportXLSX}
              disabled={candidates.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#E5484D] text-white rounded-md text-sm font-medium hover:bg-[#d03c41] disabled:opacity-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              导出 Excel
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#E6EAF2] p-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#637089]" />
              <input
                type="text"
                value={searchName}
                onChange={(e) => {
                  setSearchName(e.target.value)
                  setPage(1)
                }}
                placeholder="搜索姓名..."
                className="w-full pl-9 pr-3 h-9 rounded-md border border-[#C8CDD8] text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF] bg-white"
              />
            </div>

            {/* User filter (admin only) */}
            {isAdmin && users.length > 0 && (
              <select
                value={filterUser}
                onChange={(e) => { setFilterUser(e.target.value); setPage(1) }}
                className="h-9 px-3 rounded-md border border-[#C8CDD8] text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF] bg-white min-w-[130px]"
              >
                <option value="">全部实习生</option>
                {users.map((u) => (
                  <option key={u.username} value={u.username}>
                    {u.display_name || u.username}
                  </option>
                ))}
              </select>
            )}

            {/* Date filter */}
            <input
              type="date"
              value={dateStart}
              onChange={(e) => { setDateStart(e.target.value); setPage(1) }}
              className="h-9 px-3 rounded-md border border-[#C8CDD8] text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF] bg-white"
              title="开始日期"
            />
            <span className="text-[#637089] text-sm">-</span>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => { setDateEnd(e.target.value); setPage(1) }}
              className="h-9 px-3 rounded-md border border-[#C8CDD8] text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF] bg-white"
              title="结束日期"
            />
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={cn(
              "fixed top-20 right-6 z-[60] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2",
              toast.type === "success"
                ? "bg-[#16A37B] text-white"
                : "bg-[#E5484D] text-white",
            )}
          >
            {toast.type === "success" ? (
              <CheckCheck className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {toast.message}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#E6EAF2] overflow-hidden">
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#E6EAF2] border-t-[#2F6BFF]" />
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-8 w-8 text-[#E5484D] mb-2" />
              <p className="text-[#E5484D] text-sm mb-2">{error}</p>
              <button
                onClick={fetchData}
                className="text-sm text-[#2F6BFF] hover:underline"
              >
                点击重试
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && candidates.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileSpreadsheet className="h-10 w-10 text-[#C8CDD8] mb-3" />
              <p className="text-sm text-[#637089]">暂无淘汰候选人数据</p>
            </div>
          )}

          {/* Data */}
          {!loading && !error && candidates.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E6EAF2] bg-[#F6F8FB]">
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className={cn(
                          "text-left px-3 py-3 font-medium text-[#637089] whitespace-nowrap",
                          col.width,
                        )}
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="text-center px-3 py-3 font-medium text-[#637089] w-24">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((row, idx) => {
                    const isEditing = editingId === row.id
                    const rowNum = (page - 1) * pageSize + idx + 1
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          "border-b border-[#E6EAF2] transition-colors last:border-0",
                          isEditing ? "bg-[#FFF0F0]" : "hover:bg-[#F6F8FB]",
                        )}
                      >
                        {/* Index */}
                        <td className="px-3 py-2.5 text-[#637089] text-center">
                          {rowNum}
                        </td>

                        {/* Data cells */}
                        {COLUMNS.filter((c) => c.key !== "index").map(
                          (col) => {
                            const val = getCellValue(row, col.key as string)
                            if (isEditing && col.editable) {
                              return (
                                <td
                                  key={col.key}
                                  className="px-3 py-2.5"
                                >
                                  {col.key === "eliminate_status" ? (
                                    <select
                                      value={formatCellValue(
                                        editForm[
                                          col.key as keyof Candidate
                                        ],
                                      )}
                                      onChange={(e) =>
                                        handleFieldChange(
                                          col.key as string,
                                          e.target.value,
                                        )
                                      }
                                      className="px-2 py-1 rounded border border-[#E5484D] text-sm focus:outline-none focus:ring-1 focus:ring-[#E5484D] bg-white min-w-[130px]"
                                    >
                                      <option value="">请选择</option>
                                      {ELIMINATE_STATUSES.map((s) => (
                                        <option key={s} value={s}>
                                          {s}
                                        </option>
                                      ))}
                                    </select>
                                  ) : col.key === "gender" ? (
                                    <select
                                      value={formatCellValue(
                                        editForm[
                                          col.key as keyof Candidate
                                        ],
                                      )}
                                      onChange={(e) =>
                                        handleFieldChange(
                                          col.key as string,
                                          e.target.value,
                                        )
                                      }
                                      className="px-2 py-1 rounded border border-[#E5484D] text-sm focus:outline-none focus:ring-1 focus:ring-[#E5484D] bg-white min-w-[70px]"
                                    >
                                      <option value="">请选择</option>
                                      <option value="男">男</option>
                                      <option value="女">女</option>
                                    </select>
                                  ) : col.key === "education" ? (
                                    <select
                                      value={formatCellValue(
                                        editForm[
                                          col.key as keyof Candidate
                                        ],
                                      )}
                                      onChange={(e) =>
                                        handleFieldChange(
                                          col.key as string,
                                          e.target.value,
                                        )
                                      }
                                      className="px-2 py-1 rounded border border-[#E5484D] text-sm focus:outline-none focus:ring-1 focus:ring-[#E5484D] bg-white min-w-[90px]"
                                    >
                                      <option value="">请选择</option>
                                      <option value="本科（全日制）">本科（全日制）</option>
                                      <option value="专转本（非全日制）">专转本（非全日制）</option>
                                      <option value="专转本（全日制）">专转本（全日制）</option>
                                      <option value="硕士">硕士</option>
                                      <option value="专科（全日制）">专科（全日制）</option>
                                      <option value="专科（非全日制）">专科（非全日制）</option>
                                    </select>
                                  ) : col.key === "is_fresh_grad" ? (
                                    <select
                                      value={formatCellValue(
                                        editForm[
                                          col.key as keyof Candidate
                                        ],
                                      )}
                                      onChange={(e) =>
                                        handleFieldChange(
                                          col.key as string,
                                          e.target.value,
                                        )
                                      }
                                      className="px-2 py-1 rounded border border-[#E5484D] text-sm focus:outline-none focus:ring-1 focus:ring-[#E5484D] bg-white min-w-[70px]"
                                    >
                                      <option value="">请选择</option>
                                      <option value="是">是</option>
                                      <option value="否">否</option>
                                    </select>
                                  ) : col.key === "birth_year" ? (
                                    <input
                                      type="number"
                                      value={
                                        editForm[
                                          col.key as keyof Candidate
                                        ] ?? ""
                                      }
                                      onChange={(e) =>
                                        handleFieldChange(
                                          col.key as string,
                                          e.target.value
                                            ? Number(e.target.value)
                                            : undefined,
                                        )
                                      }
                                      className="w-20 px-2 py-1 rounded border border-[#E5484D] text-sm focus:outline-none focus:ring-1 focus:ring-[#E5484D]"
                                      placeholder="年份"
                                    />
                                  ) : col.key === "channel" ? (
                                    <select
                                      value={formatCellValue(editForm[col.key as keyof Candidate])}
                                      onChange={(e) => handleFieldChange(col.key as string, e.target.value)}
                                      className="px-2 py-1 rounded border border-[#E5484D] text-sm focus:outline-none focus:ring-1 focus:ring-[#E5484D] bg-white min-w-[100px]"
                                    >
                                      <option value="">请选择</option>
                                      {CHANNEL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                  ) : col.key === "communicate_time" ? (
                                    <input
                                      type="date"
                                      value={formatCellValue(editForm[col.key as keyof Candidate])}
                                      onChange={(e) => handleFieldChange(col.key as string, e.target.value)}
                                      className="px-2 py-1 rounded border border-[#E5484D] text-sm focus:outline-none focus:ring-1 focus:ring-[#E5484D]"
                                    />
                                  ) : (
                                    <input
                                      type="text"
                                      value={formatCellValue(
                                        editForm[
                                          col.key as keyof Candidate
                                        ],
                                      )}
                                      onChange={(e) =>
                                        handleFieldChange(
                                          col.key as string,
                                          e.target.value,
                                        )
                                      }
                                      className="w-full min-w-[80px] px-2 py-1 rounded border border-[#E5484D] text-sm focus:outline-none focus:ring-1 focus:ring-[#E5484D]"
                                    />
                                  )}
                                </td>
                              )
                            }
                            const displayVal = col.key === "communicate_time" ? formatCellValue(val).replace(/-/g, "/") : formatCellValue(val)
                            return (
                              <td
                                key={col.key}
                                className="px-3 py-2.5 text-[#152033] max-w-[200px] truncate"
                                title={displayVal}
                              >
                                {col.key === "eliminate_status" ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-[#E5484D]">
                                    {displayVal}
                                  </span>
                                ) : (
                                  displayVal
                                )}
                              </td>
                            )
                          },
                        )}

                        {/* Actions */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-1">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={saveEdit}
                                  className="p-1.5 rounded hover:bg-[#DEE8FF] text-[#2F6BFF]"
                                  title="保存"
                                >
                                  <Save className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="p-1.5 rounded hover:bg-red-50 text-[#E5484D]"
                                  title="取消"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit(row)}
                                  className="p-1.5 rounded hover:bg-[#EDF0F7] text-[#637089] hover:text-[#2F6BFF]"
                                  title="编辑"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => copyRow(row, rowNum)}
                                  className="p-1.5 rounded hover:bg-[#EDF0F7] text-[#637089] hover:text-[#16A37B]"
                                  title="复制行"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleMoveToRecommendation(row.id, row.intern_name)}
                                  className="p-1.5 rounded hover:bg-green-50 text-[#637089] hover:text-[#16A37B]"
                                  title="转入推荐"
                                >
                                  <ArrowRightLeft className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCandidate(row.id, row.intern_name)}
                                  className="p-1.5 rounded hover:bg-red-50 text-[#637089] hover:text-[#E5484D]"
                                  title="删除"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && candidates.length > 0 && (
            <div className="px-4 py-3 border-t border-[#E6EAF2]">
              {renderPagination()}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
