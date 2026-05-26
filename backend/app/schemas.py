"""Pydantic schemas — v2.0 only"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator


# ─── Auth ─────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=6)

class UserResponse(BaseModel):
    id: int
    username: str
    display_name: str
    role: str
    is_active: bool = True
    password_changed: int = 0
    class Config: from_attributes = True

class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=6)
    display_name: str
    role: str = "intern"

class ResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=6)


# ─── Candidates ───────────────────────────────────────────────────
class CandidateBase(BaseModel):
    name: str = ""
    phone: Optional[str] = None
    email: Optional[str] = None
    gender: Optional[str] = None
    birth_year: Optional[int] = None
    school: Optional[str] = None
    major: Optional[str] = None
    education: Optional[str] = None
    is_fresh_grad: Optional[str] = None
    channel: Optional[str] = None
    communicate_time: Optional[str] = None
    pushed_to_dept: bool = False
    dept_eval_passed: bool = False
    first_interview_show: bool = False
    interview_invited: bool = False
    second_interview: bool = False
    second_interview_show: bool = False
    offer_sent: bool = False
    department: Optional[str] = None
    position: Optional[str] = None
    evaluator: Optional[str] = None
    interviewer: Optional[str] = None
    result: Optional[str] = None
    recommend_detail: Optional[str] = None
    eliminate_status: Optional[str] = None
    eliminate_detail: Optional[str] = None
    resume_raw_text: Optional[str] = None

class CandidateCreate(CandidateBase):
    pass

class CandidateUpdate(CandidateBase):
    pass

class CandidateResponse(CandidateBase):
    id: int
    intern_name: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True

class CandidateListResponse(BaseModel):
    items: List[CandidateResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ─── Daily / Weekly Reports ──────────────────────────────────────
class DailyReportCreate(BaseModel):
    record_date: Optional[str] = None
    name: Optional[str] = None
    boss_chat: int = 0
    zhilian_chat: int = 0
    wuyou_chat: int = 0
    boss_resume: int = 0
    zhilian_resume: int = 0
    wuyou_resume: int = 0
    other_resume: int = 0
    boss_call: int = 0
    zhilian_call: int = 0
    wuyou_call: int = 0
    moka_call: int = 0
    other_call: int = 0
    moka_process: int = 0
    boss_vip: Optional[str] = None
    zhilian_vip: Optional[str] = None
    wuyou_vip: Optional[str] = None
    remarks: Optional[str] = None
    sort_order: int = 0

class DailyReportUpdate(BaseModel):
    record_date: Optional[str] = None
    name: Optional[str] = None
    boss_chat: Optional[int] = None
    zhilian_chat: Optional[int] = None
    wuyou_chat: Optional[int] = None
    boss_resume: Optional[int] = None
    zhilian_resume: Optional[int] = None
    wuyou_resume: Optional[int] = None
    other_resume: Optional[int] = None
    boss_call: Optional[int] = None
    zhilian_call: Optional[int] = None
    wuyou_call: Optional[int] = None
    moka_call: Optional[int] = None
    other_call: Optional[int] = None
    moka_process: Optional[int] = None
    boss_vip: Optional[str] = None
    zhilian_vip: Optional[str] = None
    wuyou_vip: Optional[str] = None
    remarks: Optional[str] = None
    sort_order: Optional[int] = None

class DailyReportResponse(BaseModel):
    id: int
    owner_id: str
    record_date: Optional[str] = None
    name: Optional[str] = None
    boss_chat: int = 0
    zhilian_chat: int = 0
    wuyou_chat: int = 0
    boss_resume: int = 0
    zhilian_resume: int = 0
    wuyou_resume: int = 0
    other_resume: int = 0
    boss_call: int = 0
    zhilian_call: int = 0
    wuyou_call: int = 0
    moka_call: int = 0
    other_call: int = 0
    moka_process: int = 0
    boss_vip: Optional[str] = None
    zhilian_vip: Optional[str] = None
    wuyou_vip: Optional[str] = None
    remarks: Optional[str] = None
    sort_order: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True

class WeeklyReportCreate(BaseModel):
    week_range: Optional[str] = None
    name: Optional[str] = None
    boss_contact: int = 0
    zhilian_contact: int = 0
    wuyou_contact: int = 0
    moka_contact: int = 0
    boss_refer: int = 0
    zhilian_refer: int = 0
    wuyou_refer: int = 0
    moka_refer: int = 0
    first_interview_invite: int = 0
    first_interview_show: int = 0
    first_interview_pass: int = 0
    second_interview_invite: int = 0
    second_interview_show: int = 0
    second_interview_pass: int = 0
    summary_1: Optional[str] = None
    summary_2: Optional[str] = None
    summary_3: Optional[str] = None
    summary_4: Optional[str] = None
    attendance_date: Optional[str] = None
    attendance_time: Optional[str] = None
    attendance_reason: Optional[str] = None
    sort_order: int = 0

class WeeklyReportUpdate(BaseModel):
    week_range: Optional[str] = None
    name: Optional[str] = None
    boss_contact: Optional[int] = None
    zhilian_contact: Optional[int] = None
    wuyou_contact: Optional[int] = None
    moka_contact: Optional[int] = None
    boss_refer: Optional[int] = None
    zhilian_refer: Optional[int] = None
    wuyou_refer: Optional[int] = None
    moka_refer: Optional[int] = None
    first_interview_invite: Optional[int] = None
    first_interview_show: Optional[int] = None
    first_interview_pass: Optional[int] = None
    second_interview_invite: Optional[int] = None
    second_interview_show: Optional[int] = None
    second_interview_pass: Optional[int] = None
    summary_1: Optional[str] = None
    summary_2: Optional[str] = None
    summary_3: Optional[str] = None
    summary_4: Optional[str] = None
    attendance_date: Optional[str] = None
    attendance_time: Optional[str] = None
    attendance_reason: Optional[str] = None
    sort_order: Optional[int] = None

class WeeklyReportResponse(BaseModel):
    id: int
    owner_id: str
    week_range: Optional[str] = None
    name: Optional[str] = None
    boss_contact: int = 0
    zhilian_contact: int = 0
    wuyou_contact: int = 0
    moka_contact: int = 0
    boss_refer: int = 0
    zhilian_refer: int = 0
    wuyou_refer: int = 0
    moka_refer: int = 0
    first_interview_invite: int = 0
    first_interview_show: int = 0
    first_interview_pass: int = 0
    second_interview_invite: int = 0
    second_interview_show: int = 0
    second_interview_pass: int = 0
    summary_1: Optional[str] = None
    summary_2: Optional[str] = None
    summary_3: Optional[str] = None
    summary_4: Optional[str] = None
    attendance_date: Optional[str] = None
    attendance_time: Optional[str] = None
    attendance_reason: Optional[str] = None
    sort_order: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True


# ─── Statistics ───────────────────────────────────────────────────
class StatisticsResult(BaseModel):
    pushed_to_dept: int = 0
    dept_eval_passed: int = 0
    first_interview_show: int = 0
    interview_invited: int = 0
    second_interview: int = 0
    second_interview_show: int = 0
    offer_sent: int = 0

class DailyStatsResponse(BaseModel):
    date: str
    today: StatisticsResult
    yesterday: StatisticsResult
    changes: StatisticsResult
    changeRates: Dict[str, str]
    byDepartment: Dict[str, StatisticsResult]
    byPosition: Dict[str, StatisticsResult]

class WeeklyStatsResponse(BaseModel):
    weekStart: str
    weekEnd: str
    dailyData: Dict[str, StatisticsResult]
    weeklyTotal: StatisticsResult
    dailyAvg: StatisticsResult
    byIntern: Dict[str, StatisticsResult]
    byDepartment: Dict[str, StatisticsResult]
    byPosition: Dict[str, StatisticsResult]
    byInternDeptPosition: Dict[str, StatisticsResult]

class ChannelCallsResponse(BaseModel):
    boss_call: int = 0
    zhilian_call: int = 0
    wuyou_call: int = 0
    moka_call: int = 0
    other_call: int = 0


# ─── Resume ───────────────────────────────────────────────────────
class ResumeExtractedInfo(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gender: Optional[str] = None
    birth_year: Optional[Any] = None
    school: Optional[str] = None
    major: Optional[str] = None
    education: Optional[str] = None
    is_fresh_grad: Optional[str] = None
    channel: Optional[str] = None

    @field_validator("birth_year", mode="before")
    @classmethod
    def coerce_birth_year(cls, v):
        if v is None:
            return None
        try:
            return int(v)
        except (TypeError, ValueError):
            return None

    @field_validator("is_fresh_grad", mode="before")
    @classmethod
    def coerce_is_fresh_grad(cls, v):
        if v is None:
            return None
        if isinstance(v, bool):
            return "是" if v else "否"
        return str(v)

class ResumeParseResponse(BaseModel):
    filename: str
    page_count: int
    raw_text: str
    parse_mode: str = "text"
    extracted: ResumeExtractedInfo
