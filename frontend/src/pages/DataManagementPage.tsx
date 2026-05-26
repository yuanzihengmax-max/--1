import { useState, useEffect, useCallback, useRef } from "react"
import AppNav from "@/components/AppNav"
import {
  getCandidates,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  importCandidates,
  getUsers,
} from "@/lib/api"
import type { Candidate, CandidateList, UserInfo } from "@/types"
import { toast } from "sonner"
import { Plus, Search, Pencil, Trash2, X, FileUp, FileDown } from "lucide-react"

const DEPT_OPTIONS = ["直销中心"]
const POSITION_OPTIONS = ["销售代表"]
const CHANNEL_OPTIONS = ["BOSS","智联","前程无忧","猎聘","新媒体（小红书、抖音等）","内推","校招线下双选会","实习僧","其他"]

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"

interface FilterState {
  department: string
  position: string
  evaluator: string
  dateStart: string
  dateEnd: string
}

interface CandidateFormData {
  name: string
  department: string
  position: string
  evaluator: string
  interviewer: string
  channel: string
  communicate_time: string
  pushed_to_dept: boolean
  dept_eval_passed: boolean
  first_interview_show: boolean
  interview_invited: boolean
  second_interview: boolean
  second_interview_show: boolean
  offer_sent: boolean
}

interface PaginationState {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const INDICATOR_LABELS: { key: keyof CandidateFormData; label: string }[] = [
  { key: "pushed_to_dept", label: "电筛通过" },
  { key: "dept_eval_passed", label: "初试邀约" },
  { key: "first_interview_show", label: "初试到面" },
  { key: "interview_invited", label: "初试通过" },
  { key: "second_interview", label: "复试邀约" },
  { key: "second_interview_show", label: "复试到面" },
  { key: "offer_sent", label: "复试通过" },
]

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

const emptyForm: CandidateFormData = {
  name: "",
  department: "",
  position: "",
  evaluator: "",
  interviewer: "",
  channel: "",
  communicate_time: "",
  pushed_to_dept: false,
  dept_eval_passed: false,
  first_interview_show: false,
  interview_invited: false,
  second_interview: false,
  second_interview_show: false,
  offer_sent: false,
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

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}/${m}/${day}`
}

function candidateToForm(c: Candidate): CandidateFormData {
  return {
    name: c.name || "",
    department: c.department || "",
    position: c.position || "",
    evaluator: c.evaluator || "",
    interviewer: c.interviewer || "",
    channel: c.channel || "",
    communicate_time: c.communicate_time || "",
    pushed_to_dept: c.pushed_to_dept || false,
    dept_eval_passed: c.dept_eval_passed || false,
    first_interview_show: (c as any).first_interview_show || false,
    interview_invited: c.interview_invited || false,
    second_interview: c.second_interview || false,
    second_interview_show: (c as any).second_interview_show || false,
    offer_sent: c.offer_sent || false,
  }
}

export default function DataManagementPage() {
  const currentUser = getCurrentUser()

  // Filter state
  const [users, setUsers] = useState<UserInfo[]>([])
  const [filter, setFilter] = useState<FilterState>({
    department: "",
    position: "",
    evaluator: "",
    dateStart: "",
    dateEnd: "",
  })

  // Data
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<CandidateFormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  // Import
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  // Fetch candidates
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = {
        page: pagination.page,
        page_size: pagination.pageSize,
      }
      if (filter.department) params.department = filter.department
      if (filter.position) params.position = filter.position
      if (filter.evaluator) params.evaluator = filter.evaluator
      if (filter.dateStart) params.date_start = filter.dateStart
      if (filter.dateEnd) params.date_end = filter.dateEnd

      const result: CandidateList = await getCandidates(params)
      setCandidates(result.items || [])
      setPagination((prev) => ({
        ...prev,
        total: result.total,
        totalPages: result.total_pages,
      }))
    } catch (err) {
      console.error(err)
      toast.error("获取数据失败")
    } finally {
      setLoading(false)
    }
  }, [filter, pagination.page, pagination.pageSize])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Fetch users for evaluator filter
  useEffect(() => {
    getUsers().then(setUsers).catch(() => {})
  }, [])

  // Reset page when filter changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }))
  }, [filter.department, filter.position, filter.evaluator, filter.dateStart, filter.dateEnd])

  // Open create dialog
  const handleOpenCreate = useCallback(() => {
    setEditingId(null)
    setFormData(emptyForm)
    setDialogOpen(true)
  }, [])

  // Open edit dialog
  const handleOpenEdit = useCallback((candidate: Candidate) => {
    setEditingId(candidate.id)
    setFormData(candidateToForm(candidate))
    setDialogOpen(true)
  }, [])

  // Close dialog
  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false)
    setEditingId(null)
    setFormData(emptyForm)
  }, [])

  // Save (create or update)
  const handleSave = useCallback(async () => {
    if (!formData.name.trim()) {
      toast.error("请输入姓名")
      return
    }
    setSaving(true)
    try {
      if (editingId !== null) {
        const updated = await updateCandidate(editingId, formData as Partial<Candidate>)
        setCandidates((prev) =>
          prev.map((c) => (c.id === editingId ? updated : c))
        )
        toast.success("已更新")
      } else {
        const created = await createCandidate(formData as Partial<Candidate>)
        setCandidates((prev) => [...prev, created])
        setPagination((prev) => ({ ...prev, total: prev.total + 1 }))
        toast.success("已创建")
      }
      handleCloseDialog()
    } catch (err) {
      console.error(err)
      toast.error("保存失败")
    } finally {
      setSaving(false)
    }
  }, [formData, editingId, handleCloseDialog])

  // Delete
  const handleDelete = useCallback(async (id: number) => {
    if (!window.confirm("确定要删除此候选人吗？")) return
    try {
      await deleteCandidate(id)
      setCandidates((prev) => prev.filter((c) => c.id !== id))
      setPagination((prev) => ({ ...prev, total: prev.total - 1 }))
      toast.success("已删除")
    } catch (err) {
      console.error(err)
      toast.error("删除失败")
    }
  }, [])

  // Import Excel
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      setImporting(true)
      try {
        const result = await importCandidates(file)
        toast.success(
          `导入完成：成功 ${result.imported}/${result.total} 条` +
            (result.errors?.length ? `，${result.errors.length} 条错误` : "")
        )
        if (result.errors?.length) {
          console.warn("导入错误:", result.errors)
        }
        fetchData()
      } catch (err) {
        console.error(err)
        toast.error("导入失败")
      } finally {
        setImporting(false)
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    },
    [fetchData]
  )

  // Export CSV with BOM
  const handleExportCSV = useCallback(() => {
    const headers = [
      "姓名",
      "部门",
      "岗位",
      "评估人",
      "面试官",
      "日期",
      "电筛通过",
      "初试邀约",
      "初试到面",
      "初试通过",
      "复试邀约",
      "复试到面",
      "复试通过",
    ]

    const rows = candidates.map((c) => [
      c.name || "",
      c.department || "",
      c.position || "",
      c.evaluator || "",
      c.interviewer || "",
      (c.communicate_time || "").replace(/-/g, "/"),
      c.pushed_to_dept ? "是" : "否",
      c.dept_eval_passed ? "是" : "否",
      (c as any).first_interview_show ? "是" : "否",
      c.interview_invited ? "是" : "否",
      c.second_interview ? "是" : "否",
      (c as any).second_interview_show ? "是" : "否",
      c.offer_sent ? "是" : "否",
    ])

    // Escape CSV fields
    const escapeCsv = (val: string): string => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    }

    const csvContent =
      "﻿" +
      [headers.map(escapeCsv).join(",")]
        .concat(rows.map((row) => row.map(escapeCsv).join(",")))
        .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `候选人数据_${formatDate(new Date())}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("导出成功")
  }, [candidates])

  // Page change
  const handlePageChange = useCallback((newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }))
  }, [])

  const handlePageSizeChange = useCallback((newSize: string) => {
    setPagination((prev) => ({ ...prev, pageSize: parseInt(newSize, 10), page: 1 }))
  }, [])

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <AppNav />
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        {/* Page header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-[#152033]">数据管理</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOpenCreate}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#2F6BFF] px-4 text-sm font-medium text-white hover:bg-[#1a5ae0]"
            >
              <Plus className="h-4 w-4" />
              新增
            </button>
            <button
              onClick={handleImportClick}
              disabled={importing}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#C8CDD8] bg-white px-4 text-sm font-medium text-[#152033] hover:bg-gray-50 disabled:opacity-50"
            >
              <FileUp className="h-4 w-4" />
              {importing ? "导入中..." : "导入Excel"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={handleExportCSV}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#C8CDD8] bg-white px-4 text-sm font-medium text-[#152033] hover:bg-gray-50"
            >
              <FileDown className="h-4 w-4" />
              导出CSV
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-white p-4 shadow-sm border border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-[#637089]" />
            <span className="text-sm text-[#637089]">筛选</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Department filter */}
            <div>
              <select
                value={filter.department}
                onChange={(e) =>
                  setFilter((prev) => ({ ...prev, department: e.target.value }))
                }
                className="h-9 rounded-md border border-[#C8CDD8] bg-white px-3 text-sm text-[#152033] outline-none focus:ring-2 focus:ring-[#2F6BFF] min-w-[120px]"
              >
                <option value="">全部部门</option>
                {DEPT_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Position filter */}
            <div>
              <select
                value={filter.position}
                onChange={(e) =>
                  setFilter((prev) => ({ ...prev, position: e.target.value }))
                }
                className="h-9 rounded-md border border-[#C8CDD8] bg-white px-3 text-sm text-[#152033] outline-none focus:ring-2 focus:ring-[#2F6BFF] min-w-[120px]"
              >
                <option value="">全部岗位</option>
                {POSITION_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Evaluator filter */}
            <div>
              <select
                value={filter.evaluator}
                onChange={(e) =>
                  setFilter((prev) => ({ ...prev, evaluator: e.target.value }))
                }
                className="h-9 rounded-md border border-[#C8CDD8] bg-white px-3 text-sm text-[#152033] outline-none focus:ring-2 focus:ring-[#2F6BFF] min-w-[120px]"
              >
                <option value="">全部评估人</option>
                {users.filter(u => u.role === "intern").map((u) => (
                  <option key={u.username} value={u.username}>
                    {u.display_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filter.dateStart}
                onChange={(e) =>
                  setFilter((prev) => ({ ...prev, dateStart: e.target.value }))
                }
                className="h-9 rounded-md border border-[#C8CDD8] bg-white px-3 text-sm text-[#152033] outline-none focus:ring-2 focus:ring-[#2F6BFF]"
                placeholder="开始日期"
              />
              <span className="text-[#637089]">-</span>
              <input
                type="date"
                value={filter.dateEnd}
                onChange={(e) =>
                  setFilter((prev) => ({ ...prev, dateEnd: e.target.value }))
                }
                className="h-9 rounded-md border border-[#C8CDD8] bg-white px-3 text-sm text-[#152033] outline-none focus:ring-2 focus:ring-[#2F6BFF]"
                placeholder="结束日期"
              />
            </div>

            {/* Clear filter */}
            {(filter.department ||
              filter.position ||
              filter.evaluator ||
              filter.dateStart ||
              filter.dateEnd) && (
              <button
                onClick={() =>
                  setFilter({
                    department: "",
                    position: "",
                    evaluator: "",
                    dateStart: "",
                    dateEnd: "",
                  })
                }
                className="inline-flex h-9 items-center gap-1 rounded-md px-3 text-sm text-[#637089] hover:text-[#152033]"
              >
                <X className="h-4 w-4" />
                清除
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-[#E5E7EB] bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#2F6BFF] text-white">
                <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap border-r border-[#5a8fff]">
                  姓名
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap border-r border-[#5a8fff]">
                  部门
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap border-r border-[#5a8fff]">
                  岗位
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap border-r border-[#5a8fff]">
                  评估人
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap border-r border-[#5a8fff]">
                  面试官
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap border-r border-[#5a8fff]">
                  日期
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap border-r border-[#5a8fff]">
                  电筛通过
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap border-r border-[#5a8fff]">
                  初试邀约
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap border-r border-[#5a8fff]">
                  初试到面
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap border-r border-[#5a8fff]">
                  初试通过
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap border-r border-[#5a8fff]">
                  复试邀约
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap border-r border-[#5a8fff]">
                  复试到面
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap border-r border-[#5a8fff]">
                  复试通过
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap w-[100px]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={14}
                    className="px-3 py-12 text-center text-[#637089]"
                  >
                    加载中...
                  </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td
                    colSpan={14}
                    className="px-3 py-12 text-center text-[#637089]"
                  >
                    暂无数据
                  </td>
                </tr>
              ) : (
                candidates.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[#E5E7EB] hover:bg-[#F8FAFC] transition-colors"
                  >
                    <td className="px-3 py-2 text-center text-[#152033] border-r border-[#E5E7EB] font-medium">
                      {c.name}
                    </td>
                    <td className="px-3 py-2 text-center text-[#152033] border-r border-[#E5E7EB]">
                      {c.department || "-"}
                    </td>
                    <td className="px-3 py-2 text-center text-[#152033] border-r border-[#E5E7EB]">
                      {c.position || "-"}
                    </td>
                    <td className="px-3 py-2 text-center text-[#152033] border-r border-[#E5E7EB]">
                      {c.evaluator || "-"}
                    </td>
                    <td className="px-3 py-2 text-center text-[#152033] border-r border-[#E5E7EB]">
                      {c.interviewer || "-"}
                    </td>
                    <td className="px-3 py-2 text-center text-[#152033] border-r border-[#E5E7EB]">
                      {c.communicate_time ? c.communicate_time.replace(/-/g, "/") : "-"}
                    </td>
                    {/* 5 indicators */}
                    <td className="px-3 py-2 text-center border-r border-[#E5E7EB]">
                      <span
                        className={
                          c.pushed_to_dept
                            ? "text-green-600 font-bold"
                            : "text-[#C8CDD8]"
                        }
                      >
                        {c.pushed_to_dept ? "✓" : "-"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center border-r border-[#E5E7EB]">
                      <span
                        className={
                          c.dept_eval_passed
                            ? "text-green-600 font-bold"
                            : "text-[#C8CDD8]"
                        }
                      >
                        {c.dept_eval_passed ? "✓" : "-"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center border-r border-[#E5E7EB]">
                      <span
                        className={
                          (c as any).first_interview_show
                            ? "text-green-600 font-bold"
                            : "text-[#C8CDD8]"
                        }
                      >
                        {(c as any).first_interview_show ? "✓" : "-"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center border-r border-[#E5E7EB]">
                      <span
                        className={
                          c.interview_invited
                            ? "text-green-600 font-bold"
                            : "text-[#C8CDD8]"
                        }
                      >
                        {c.interview_invited ? "✓" : "-"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center border-r border-[#E5E7EB]">
                      <span
                        className={
                          c.second_interview
                            ? "text-green-600 font-bold"
                            : "text-[#C8CDD8]"
                        }
                      >
                        {c.second_interview ? "✓" : "-"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center border-r border-[#E5E7EB]">
                      <span
                        className={
                          (c as any).second_interview_show
                            ? "text-green-600 font-bold"
                            : "text-[#C8CDD8]"
                        }
                      >
                        {(c as any).second_interview_show ? "✓" : "-"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center border-r border-[#E5E7EB]">
                      <span
                        className={
                          c.offer_sent
                            ? "text-green-600 font-bold"
                            : "text-[#C8CDD8]"
                        }
                      >
                        {c.offer_sent ? "✓" : "-"}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-gray-100 text-[#637089] hover:text-[#2F6BFF]"
                          title="编辑"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
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

        {/* Pagination */}
        {pagination.totalPages > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-[#637089]">
              <span>共 {pagination.total} 条</span>
              <span className="mx-2">|</span>
              <span>
                第 {pagination.page}/{pagination.totalPages} 页
              </span>
              <span className="mx-2">|</span>
              <span>每页</span>
              <select
                value={pagination.pageSize}
                onChange={(e) => handlePageSizeChange(e.target.value)}
                className="h-8 rounded border border-[#C8CDD8] bg-white px-2 text-sm outline-none focus:ring-1 focus:ring-[#2F6BFF]"
              >
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span>条</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(1)}
                disabled={pagination.page <= 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#C8CDD8] bg-white text-sm text-[#152033] hover:bg-gray-50 disabled:opacity-40"
              >
                {"<<"}
              </button>
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#C8CDD8] bg-white text-sm text-[#152033] hover:bg-gray-50 disabled:opacity-40"
              >
                {"<"}
              </button>
              {/* Page number buttons */}
              {Array.from(
                { length: Math.min(5, pagination.totalPages) },
                (_, i) => {
                  let pageNum: number
                  const total = pagination.totalPages
                  const current = pagination.page
                  if (total <= 5) {
                    pageNum = i + 1
                  } else if (current <= 3) {
                    pageNum = i + 1
                  } else if (current >= total - 2) {
                    pageNum = total - 4 + i
                  } else {
                    pageNum = current - 2 + i
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded text-sm font-medium ${
                        pageNum === pagination.page
                          ? "bg-[#2F6BFF] text-white"
                          : "border border-[#C8CDD8] bg-white text-[#152033] hover:bg-gray-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                }
              )}
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#C8CDD8] bg-white text-sm text-[#152033] hover:bg-gray-50 disabled:opacity-40"
              >
                {">"}
              </button>
              <button
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={pagination.page >= pagination.totalPages}
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#C8CDD8] bg-white text-sm text-[#152033] hover:bg-gray-50 disabled:opacity-40"
              >
                {">>"}
              </button>
            </div>
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingId !== null ? "编辑候选人" : "新增候选人"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Basic fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#152033]">
                    姓名 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="请输入姓名"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#152033]">
                    部门
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        department: e.target.value,
                      }))
                    }
                    className="w-full h-9 rounded-md border border-[#C8CDD8] bg-white px-3 text-sm text-[#152033] outline-none focus:ring-2 focus:ring-[#2F6BFF]"
                  >
                    <option value="">请选择部门</option>
                    {DEPT_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#152033]">
                    岗位
                  </label>
                  <select
                    value={formData.position}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        position: e.target.value,
                      }))
                    }
                    className="w-full h-9 rounded-md border border-[#C8CDD8] bg-white px-3 text-sm text-[#152033] outline-none focus:ring-2 focus:ring-[#2F6BFF]"
                  >
                    <option value="">请选择岗位</option>
                    {POSITION_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#152033]">
                    评估人
                  </label>
                  <Input
                    value={formData.evaluator}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        evaluator: e.target.value,
                      }))
                    }
                    placeholder="请输入评估人"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#152033]">
                    面试官
                  </label>
                  <Input
                    value={formData.interviewer}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        interviewer: e.target.value,
                      }))
                    }
                    placeholder="请输入面试官"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#152033]">
                    招聘渠道
                  </label>
                  <select
                    value={formData.channel}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, channel: e.target.value }))
                    }
                    className="w-full h-9 rounded-md border border-[#C8CDD8] bg-white px-3 text-sm text-[#152033] outline-none focus:ring-2 focus:ring-[#2F6BFF]"
                  >
                    <option value="">请选择渠道</option>
                    {CHANNEL_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#152033]">
                    日期
                  </label>
                  <Input
                    type="date"
                    value={formData.communicate_time}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        communicate_time: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              {/* 5 indicators (checkboxes) */}
              <div className="border-t border-[#E5E7EB] pt-4">
                <p className="mb-3 text-sm font-medium text-[#152033]">
                  面试流程指标
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {INDICATOR_LABELS.map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={formData[item.key]}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({
                            ...prev,
                            [item.key]: checked === true,
                          }))
                        }
                      />
                      <span className="text-sm text-[#152033]">
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                取消
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-[#2F6BFF] hover:bg-[#1a5ae0]"
              >
                {saving ? "保存中..." : "保存"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
