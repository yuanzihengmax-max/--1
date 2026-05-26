export interface AuthUser { username: string; display_name: string; role: string; password_changed: boolean }
export interface UserInfo { id: number; username: string; display_name: string; role: string; is_active: boolean; password_changed: boolean }

export interface Candidate {
  id: number; name: string; phone?: string; email?: string; gender?: string;
  birth_year?: number; school?: string; major?: string; education?: string;
  is_fresh_grad?: string; channel?: string; communicate_time?: string;
  pushed_to_dept: boolean; dept_eval_passed: boolean; first_interview_show: boolean;
  interview_invited: boolean; second_interview: boolean; second_interview_show: boolean; offer_sent: boolean;
  department?: string; position?: string; evaluator?: string; interviewer?: string;
  result?: string; recommend_detail?: string; eliminate_status?: string;
  eliminate_detail?: string; resume_raw_text?: string; intern_name: string;
}

export interface CandidateList { items: Candidate[]; total: number; page: number; page_size: number; total_pages: number }

export interface DailyReport { id: number; owner_id: string; record_date?: string; name?: string;
  boss_chat: number; zhilian_chat: number; wuyou_chat: number;
  boss_resume: number; zhilian_resume: number; wuyou_resume: number; other_resume: number;
  boss_call: number; zhilian_call: number; wuyou_call: number; moka_call: number; other_call: number;
  moka_process: number; boss_vip?: string; zhilian_vip?: string; wuyou_vip?: string;
  remarks?: string; sort_order: number; }

export interface WeeklyReport { id: number; owner_id: string; week_range?: string; name?: string;
  boss_contact: number; zhilian_contact: number; wuyou_contact: number; moka_contact: number;
  boss_refer: number; zhilian_refer: number; wuyou_refer: number; moka_refer: number;
  first_interview_invite: number; first_interview_show: number; first_interview_pass: number;
  second_interview_invite: number; second_interview_show: number; second_interview_pass: number;
  summary_1?: string; summary_2?: string; summary_3?: string; summary_4?: string;
  attendance_date?: string; attendance_time?: string; attendance_reason?: string; sort_order: number; }

export interface StatisticsResult { pushed_to_dept: number; dept_eval_passed: number; first_interview_show: number; interview_invited: number; second_interview: number; second_interview_show: number; offer_sent: number }
export interface DailyStats { date: string; today: StatisticsResult; yesterday: StatisticsResult; changes: StatisticsResult; changeRates: Record<string,string>; byDepartment: Record<string,StatisticsResult>; byPosition: Record<string,StatisticsResult> }
export interface WeeklyStats { weekStart: string; weekEnd: string; dailyData: Record<string,StatisticsResult>; weeklyTotal: StatisticsResult; dailyAvg: StatisticsResult; byIntern: Record<string,StatisticsResult>; byDepartment: Record<string,StatisticsResult>; byPosition: Record<string,StatisticsResult>; byInternDeptPosition: Record<string,StatisticsResult> }
export interface ChannelCalls { boss_call: number; zhilian_call: number; wuyou_call: number; moka_call: number; other_call: number }
export interface WeeklyChannelStats { contact: { boss: number; zhilian: number; wuyou: number; moka: number }; refer: { boss: number; zhilian: number; wuyou: number; moka: number } }
