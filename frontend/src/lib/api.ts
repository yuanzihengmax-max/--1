import axios from "axios"
import type { Candidate, CandidateList, DailyReport, WeeklyReport, DailyStats, WeeklyStats, ChannelCalls, WeeklyChannelStats, UserInfo, AuthUser } from "@/types"

export const api = axios.create({ baseURL: "" })

let _onLogout: (() => void) | null = null
export const setLogoutHandler = (fn: () => void) => { _onLogout = fn }

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("auth-storage-v2")
  if (token) {
    try {
      const parsed = JSON.parse(token)
      if (parsed.state?.token) cfg.headers.Authorization = `Bearer ${parsed.state.token}`
    } catch {}
  }
  return cfg
})

api.interceptors.response.use(r => r, (err) => {
  if (err.response?.status === 401 && _onLogout) _onLogout()
  return Promise.reject(err)
})

// Auth
export const loginApi = (u: string, p: string) =>
  api.post<{token:string,user:AuthUser}>("/api/auth/login", {username:u,password:p}).then(r=>r.data)
export const getMe = () => api.get<AuthUser>("/api/auth/me").then(r=>r.data)
export const changePwd = (oldP: string, newP: string) =>
  api.post("/api/auth/change-password", {old_password:oldP, new_password:newP}).then(r=>r.data)
export const getUsers = () => api.get<UserInfo[]>("/api/users").then(r=>r.data)
export const createUserApi = (data: {username:string,password:string,display_name:string,role:string}) =>
  api.post("/api/users", data).then(r=>r.data)
export const resetUserPwd = (id:number, pwd:string) =>
  api.post(`/api/users/${id}/reset-password`, {new_password:pwd}).then(r=>r.data)
export const toggleUserActive = (id:number) =>
  api.post(`/api/users/${id}/toggle-active`).then(r=>r.data)

// Candidates
export const getCandidates = (params?: Record<string,string|number>) =>
  api.get<CandidateList>("/api/candidates", {params}).then(r=>r.data)
export const createCandidate = (data: Partial<Candidate>) =>
  api.post<Candidate>("/api/candidates", data).then(r=>r.data)
export const updateCandidate = (id: number, data: Partial<Candidate>, intern_name?: string) =>
  api.put<Candidate>(`/api/candidates/${id}`, data, { params: intern_name ? { intern_name } : undefined }).then(r=>r.data)
export const deleteCandidate = (id: number, intern_name?: string) =>
  api.delete(`/api/candidates/${id}`, { params: intern_name ? { intern_name } : undefined }).then(r=>r.data)
export const importCandidates = (file: File) => {
  const fd = new FormData(); fd.append("file", file)
  return api.post<{imported:number, total:number, errors:string[]}>("/api/candidates/import", fd).then(r=>r.data)
}

// Reports
export const getDailyReports = (params?: Record<string,string>) =>
  api.get<DailyReport[]>("/api/daily-reports", {params}).then(r=>r.data)
export const createDailyReport = (data: Partial<DailyReport>) =>
  api.post<DailyReport>("/api/daily-reports", data).then(r=>r.data)
export const updateDailyReport = (id: number, data: Partial<DailyReport>) =>
  api.put<DailyReport>(`/api/daily-reports/${id}`, data).then(r=>r.data)
export const deleteDailyReport = (id: number) =>
  api.delete(`/api/daily-reports/${id}`).then(r=>r.data)
export const getWeeklyReports = (params?: Record<string,string>) =>
  api.get<WeeklyReport[]>("/api/weekly-reports", {params}).then(r=>r.data)
export const createWeeklyReport = (data: Partial<WeeklyReport>) =>
  api.post<WeeklyReport>("/api/weekly-reports", data).then(r=>r.data)
export const updateWeeklyReport = (id: number, data: Partial<WeeklyReport>) =>
  api.put<WeeklyReport>(`/api/weekly-reports/${id}`, data).then(r=>r.data)
export const deleteWeeklyReport = (id: number) =>
  api.delete(`/api/weekly-reports/${id}`).then(r=>r.data)

// Statistics
export const getDailyStats = (params?: Record<string,string>) =>
  api.get<DailyStats>("/api/statistics/daily", {params}).then(r=>r.data)
export const getWeeklyStats = (params?: Record<string,string>) =>
  api.get<WeeklyStats>("/api/statistics/weekly", {params}).then(r=>r.data)
export const getChannelCalls = (params?: Record<string,string>) =>
  api.get<ChannelCalls>("/api/statistics/channel-calls", {params}).then(r=>r.data)
export const getWeeklyChannelStats = (start_date: string, end_date: string) =>
  api.get<WeeklyChannelStats>("/api/statistics/weekly-channel-stats", {params: {start_date, end_date}}).then(r=>r.data)
export const getPipelineStats = (start_date: string, end_date: string) =>
  api.get<Record<string,number>>("/api/statistics/pipeline-stats", {params: {start_date, end_date}}).then(r=>r.data)

// Resume
export const parseResume = (file: File) => {
  const fd = new FormData(); fd.append("file", file)
  return api.post<any>("/api/resume/parse", fd).then(r=>r.data)
}
