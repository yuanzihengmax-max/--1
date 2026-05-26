"""SQLAlchemy ORM 模型 — 仅 v2.0 需要的表"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, REAL, Text, DateTime, Boolean, func, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, default="intern")
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    password_changed: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ScoringConfig(Base):
    __tablename__ = "scoring_config"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    dimension_name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    weight: Mapped[float] = mapped_column(REAL, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, default="")
    phone: Mapped[Optional[str]] = mapped_column(String, index=True)
    email: Mapped[Optional[str]] = mapped_column(String)
    gender: Mapped[Optional[str]] = mapped_column(String)
    birth_year: Mapped[Optional[int]] = mapped_column(Integer)
    school: Mapped[Optional[str]] = mapped_column(String)
    major: Mapped[Optional[str]] = mapped_column(String)
    education: Mapped[Optional[str]] = mapped_column(String)
    is_fresh_grad: Mapped[Optional[str]] = mapped_column(String)
    channel: Mapped[Optional[str]] = mapped_column(String, index=True)
    communicate_time: Mapped[Optional[str]] = mapped_column(String, index=True)
    # v2.0 pipeline metrics
    pushed_to_dept: Mapped[bool] = mapped_column(Boolean, default=False)
    dept_eval_passed: Mapped[bool] = mapped_column(Boolean, default=False)
    first_interview_show: Mapped[bool] = mapped_column(Boolean, default=False)
    interview_invited: Mapped[bool] = mapped_column(Boolean, default=False)
    second_interview: Mapped[bool] = mapped_column(Boolean, default=False)
    second_interview_show: Mapped[bool] = mapped_column(Boolean, default=False)
    offer_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    # v2.0 extended fields
    department: Mapped[Optional[str]] = mapped_column(String)
    position: Mapped[Optional[str]] = mapped_column(String)
    evaluator: Mapped[Optional[str]] = mapped_column(String)
    interviewer: Mapped[Optional[str]] = mapped_column(String)
    # ledger fields
    result: Mapped[Optional[str]] = mapped_column(String, index=True)
    recommend_detail: Mapped[Optional[str]] = mapped_column(Text)
    eliminate_status: Mapped[Optional[str]] = mapped_column(String)
    eliminate_detail: Mapped[Optional[str]] = mapped_column(Text)
    # resume
    resume_raw_text: Mapped[Optional[str]] = mapped_column(Text)
    # ownership
    intern_name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_candidates_intern_result", "intern_name", "result"),
        Index("ix_candidates_name_phone", "name", "phone"),
        Index("ix_candidates_comm_time_result", "communicate_time", "result"),
    )


class DailyReport(Base):
    __tablename__ = "daily_reports"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    record_date: Mapped[Optional[str]] = mapped_column(String)
    name: Mapped[Optional[str]] = mapped_column(String)
    boss_chat: Mapped[int] = mapped_column(Integer, default=0)
    zhilian_chat: Mapped[int] = mapped_column(Integer, default=0)
    wuyou_chat: Mapped[int] = mapped_column(Integer, default=0)
    boss_resume: Mapped[int] = mapped_column(Integer, default=0)
    zhilian_resume: Mapped[int] = mapped_column(Integer, default=0)
    wuyou_resume: Mapped[int] = mapped_column(Integer, default=0)
    other_resume: Mapped[int] = mapped_column(Integer, default=0)
    boss_call: Mapped[int] = mapped_column(Integer, default=0)
    zhilian_call: Mapped[int] = mapped_column(Integer, default=0)
    wuyou_call: Mapped[int] = mapped_column(Integer, default=0)
    moka_call: Mapped[int] = mapped_column(Integer, default=0)
    other_call: Mapped[int] = mapped_column(Integer, default=0)
    moka_process: Mapped[int] = mapped_column(Integer, default=0)
    boss_vip: Mapped[Optional[str]] = mapped_column(String)
    zhilian_vip: Mapped[Optional[str]] = mapped_column(String)
    wuyou_vip: Mapped[Optional[str]] = mapped_column(String)
    remarks: Mapped[Optional[str]] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class WeeklyReport(Base):
    __tablename__ = "weekly_reports"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    week_range: Mapped[Optional[str]] = mapped_column(String)
    name: Mapped[Optional[str]] = mapped_column(String)
    boss_contact: Mapped[int] = mapped_column(Integer, default=0)
    zhilian_contact: Mapped[int] = mapped_column(Integer, default=0)
    wuyou_contact: Mapped[int] = mapped_column(Integer, default=0)
    moka_contact: Mapped[int] = mapped_column(Integer, default=0)
    boss_refer: Mapped[int] = mapped_column(Integer, default=0)
    zhilian_refer: Mapped[int] = mapped_column(Integer, default=0)
    wuyou_refer: Mapped[int] = mapped_column(Integer, default=0)
    moka_refer: Mapped[int] = mapped_column(Integer, default=0)
    first_interview_invite: Mapped[int] = mapped_column(Integer, default=0)
    first_interview_show: Mapped[int] = mapped_column(Integer, default=0)
    first_interview_pass: Mapped[int] = mapped_column(Integer, default=0)
    second_interview_invite: Mapped[int] = mapped_column(Integer, default=0)
    second_interview_show: Mapped[int] = mapped_column(Integer, default=0)
    second_interview_pass: Mapped[int] = mapped_column(Integer, default=0)
    summary_1: Mapped[Optional[str]] = mapped_column(Text)
    summary_2: Mapped[Optional[str]] = mapped_column(Text)
    summary_3: Mapped[Optional[str]] = mapped_column(Text)
    summary_4: Mapped[Optional[str]] = mapped_column(Text)
    attendance_date: Mapped[Optional[str]] = mapped_column(String)
    attendance_time: Mapped[Optional[str]] = mapped_column(String)
    attendance_reason: Mapped[Optional[str]] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
