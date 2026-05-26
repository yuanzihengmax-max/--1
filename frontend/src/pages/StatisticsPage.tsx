import { useState, useEffect, useCallback } from "react"
import AppNav from "@/components/AppNav"
import { getDailyStats } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { DailyStats, StatisticsResult } from "@/types"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  AlertCircle,
} from "lucide-react"

interface MetricConfig {
  key: keyof StatisticsResult
  label: string
}

const METRICS: MetricConfig[] = [
  { key: "pushed_to_dept", label: "电筛通过" },
  { key: "dept_eval_passed", label: "初试邀约" },
  { key: "first_interview_show", label: "初试到面" },
  { key: "interview_invited", label: "初试通过" },
  { key: "second_interview", label: "复试邀约" },
  { key: "second_interview_show", label: "复试到面" },
  { key: "offer_sent", label: "复试通过" },
]

function formatLabel(key: string): string {
  const found = METRICS.find((m) => m.key === key)
  return found ? found.label : key
}

const DEPT_POSITION_OPTIONS = [
  { value: "", label: "全部" },
  { value: "直销中心", label: "直销中心" },
]

export default function StatisticsPage() {
  const today = new Date().toISOString().split("T")[0]
  const [date, setDate] = useState(today)
  const [department, setDepartment] = useState("")
  const [position, setPosition] = useState("")
  const [stats, setStats] = useState<DailyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const deptOptions = stats?.byDepartment
    ? ["全部", ...Object.keys(stats.byDepartment)]
    : ["全部"]
  const posOptions = stats?.byPosition
    ? ["全部", ...Object.keys(stats.byPosition)]
    : ["全部"]

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = { date }
      if (department) params.department = department
      if (position) params.position = position
      const data = await getDailyStats(params)
      setStats(data)
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail || err?.message || "获取统计数据失败"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [date, department, position])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const deptEntries = stats?.byDepartment
    ? Object.entries(stats.byDepartment)
    : []
  const posEntries = stats?.byPosition ? Object.entries(stats.byPosition) : []

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <AppNav />
      <main className="max-w-[1600px] mx-auto px-4 xl:px-6 py-6 xl:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-[#152033]">数据统计</h1>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-sm text-[#637089] hover:text-[#2F6BFF] transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={cn("h-4 w-4", loading && "animate-spin")}
            />
            刷新
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#E6EAF2] p-4 mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#637089]">日期</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 px-3 rounded-md border border-[#C8CDD8] text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF] bg-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#637089]">
                部门
              </label>
              <select
                value={department}
                onChange={(e) =>
                  setDepartment(
                    e.target.value === "全部" ? "" : e.target.value,
                  )
                }
                className="h-9 px-3 rounded-md border border-[#C8CDD8] text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF] bg-white min-w-[120px]"
              >
                {deptOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#637089]">
                岗位
              </label>
              <select
                value={position}
                onChange={(e) =>
                  setPosition(
                    e.target.value === "全部" ? "" : e.target.value,
                  )
                }
                className="h-9 px-3 rounded-md border border-[#C8CDD8] text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF] bg-white min-w-[120px]"
              >
                {posOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#E6EAF2] border-t-[#2F6BFF]" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-white rounded-xl border border-[#E6EAF2] p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <AlertCircle className="h-10 w-10 text-[#E5484D] mb-3" />
              <p className="text-[#E5484D] text-sm font-medium mb-2">
                {error}
              </p>
              <button
                onClick={fetchStats}
                className="text-sm text-[#2F6BFF] hover:underline"
              >
                点击重试
              </button>
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && !stats && (
          <div className="bg-white rounded-xl border border-[#E6EAF2] p-12">
            <div className="text-center text-sm text-[#637089]">
              暂无数据，请选择日期后查看
            </div>
          </div>
        )}

        {/* Stats content */}
        {!loading && !error && stats && (
          <>
            {/* Metric cards */}
            <section className="mb-6">
              <h2 className="text-sm font-semibold text-[#637089] uppercase tracking-wide mb-3">
                今日概览
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {METRICS.map((m) => {
                  const todayVal = stats.today[m.key] ?? 0
                  const yesterdayVal = stats.yesterday[m.key] ?? 0
                  const change = stats.changes[m.key] ?? 0
                  const rate = stats.changeRates?.[m.key] ?? "-"

                  return (
                    <div
                      key={m.key}
                      className="bg-white rounded-xl border border-[#E6EAF2] p-5"
                    >
                      <div className="text-xs text-[#637089] font-medium mb-2">
                        {m.label}
                      </div>
                      <div className="text-3xl font-bold text-[#152033] mb-3">
                        {todayVal}
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-[#637089]">
                          <span>昨日</span>
                          <span className="font-medium">{yesterdayVal}</span>
                        </div>
                        <div className="flex items-center justify-between text-[#637089]">
                          <span>变化</span>
                          <span
                            className={cn(
                              "font-medium",
                              change > 0
                                ? "text-[#16A37B]"
                                : change < 0
                                  ? "text-[#E5484D]"
                                  : "text-[#637089]",
                            )}
                          >
                            {change > 0 ? "+" : ""}
                            {change}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[#637089]">
                          <span>环比</span>
                          <span className="font-medium">{rate}</span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1">
                        {change > 0 ? (
                          <TrendingUp className="h-3.5 w-3.5 text-[#16A37B]" />
                        ) : change < 0 ? (
                          <TrendingDown className="h-3.5 w-3.5 text-[#E5484D]" />
                        ) : (
                          <Minus className="h-3.5 w-3.5 text-[#637089]" />
                        )}
                        <span
                          className={cn(
                            "text-xs font-medium",
                            change > 0
                              ? "text-[#16A37B]"
                              : change < 0
                                ? "text-[#E5484D]"
                                : "text-[#637089]",
                          )}
                        >
                          {change > 0
                            ? "较昨日上升"
                            : change < 0
                              ? "较昨日下降"
                              : "与昨日持平"}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* By department table */}
            <section className="mb-6">
              <h2 className="text-sm font-semibold text-[#637089] uppercase tracking-wide mb-3">
                按部门统计
              </h2>
              <div className="bg-white rounded-xl border border-[#E6EAF2] overflow-hidden">
                {deptEntries.length === 0 ? (
                  <div className="text-center text-sm text-[#637089] py-8">
                    暂无部门统计数据
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E6EAF2] bg-[#F6F8FB]">
                          <th className="text-left px-4 py-3 font-medium text-[#637089] whitespace-nowrap">
                            部门
                          </th>
                          {METRICS.map((m) => (
                            <th
                              key={m.key}
                              className="text-center px-3 py-3 font-medium text-[#637089] whitespace-nowrap"
                            >
                              {m.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {deptEntries.map(([dept, result]) => (
                          <tr
                            key={dept}
                            className="border-b border-[#E6EAF2] hover:bg-[#F6F8FB] transition-colors last:border-0"
                          >
                            <td className="px-4 py-3 font-medium text-[#152033] whitespace-nowrap">
                              {dept}
                            </td>
                            {METRICS.map((m) => (
                              <td
                                key={m.key}
                                className="text-center px-3 py-3 text-[#152033]"
                              >
                                {result[m.key] ?? 0}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            {/* By position table */}
            <section className="mb-6">
              <h2 className="text-sm font-semibold text-[#637089] uppercase tracking-wide mb-3">
                按岗位统计
              </h2>
              <div className="bg-white rounded-xl border border-[#E6EAF2] overflow-hidden">
                {posEntries.length === 0 ? (
                  <div className="text-center text-sm text-[#637089] py-8">
                    暂无岗位统计数据
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E6EAF2] bg-[#F6F8FB]">
                          <th className="text-left px-4 py-3 font-medium text-[#637089] whitespace-nowrap">
                            岗位
                          </th>
                          {METRICS.map((m) => (
                            <th
                              key={m.key}
                              className="text-center px-3 py-3 font-medium text-[#637089] whitespace-nowrap"
                            >
                              {m.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {posEntries.map(([pos, result]) => (
                          <tr
                            key={pos}
                            className="border-b border-[#E6EAF2] hover:bg-[#F6F8FB] transition-colors last:border-0"
                          >
                            <td className="px-4 py-3 font-medium text-[#152033] whitespace-nowrap">
                              {pos}
                            </td>
                            {METRICS.map((m) => (
                              <td
                                key={m.key}
                                className="text-center px-3 py-3 text-[#152033]"
                              >
                                {result[m.key] ?? 0}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
